#!/usr/bin/env node
// EN/fr-CA parity gate. Deterministic: no AI in this file.
//
// The AI (Copilot) writes strings. This script decides whether they are allowed to merge.
// It reads the SAME glossary the Copilot skill reads, so the rule the agent follows
// and the rule the pipeline enforces can never drift apart.
//
// Errors fail the build. Warnings print, and fail only with --strict.
//
// Checks
//   E1 missing-key       key exists in en-CA but not in fr-CA
//   E2 extra-key         key exists in fr-CA but not in en-CA (orphan / typo)
//   E3 placeholder       {variables} differ between languages
//   E4 plural            plural message is missing a required branch (one, other)
//   E5 glossary          English uses a glossary term but French does not use the approved term
//   E6 avoid-term        French uses a term the glossary says to avoid
//   E7 syntax            message cannot be parsed
//   E8 hardcoded-text    visible text in HTML that bypasses data-i18n (would ship English-only)
//   W1 untranslated      French text is identical to English
//   W2 expansion         French is much longer than English on a button or label (UI overflow risk)
//   W3 punctuation       Canadian French typography (space before colon, none before ? ! ;, « » spacing)

import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBranches } from '../src/i18n.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

export const DEFAULT_CONFIG = {
  localesDir: 'locales',
  base: 'en-CA',
  targets: ['fr-CA'],
  glossary: '.github/skills/fr-ca-terminology/glossary.csv',
  expansionRatio: 1.5,
  expansionKeyPattern: /(button|toggle)$/, // buttons don't wrap; labels usually can
  untranslatedAllowlist: new Set(['Service Canada', 'OK']),
  htmlFiles: ['src/index.html'],
};

// ---------- parsing helpers ----------

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, idx) => [h.trim(), (r[idx] ?? '').trim()])));
}

export function loadGlossary(path) {
  if (!existsSync(path)) return [];
  return parseCsv(readFileSync(path, 'utf8')).map((r) => ({
    en: r.en,
    approved: splitAlts(r.fr_ca),
    avoid: splitAlts(r.avoid),
    note: r.note || '',
  }));
}

const splitAlts = (s) => (s ? s.split('|').map((x) => x.trim()).filter(Boolean) : []);

// Normalise for comparison: lowercase, curly apostrophes -> straight, NBSP -> space.
const norm = (s) => s.toLowerCase().replace(/[\u2019\u2018]/g, "'").replace(/[\u00a0\u202f]/g, ' ');

// Whole-word match that understands accented letters (é, à, ç...).
function containsTerm(text, term) {
  const escaped = norm(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'u').test(norm(text));
}

// Remove {placeholders} so a variable named {email} is not mistaken for the word "email".
const stripPlaceholders = (s) => s.replace(/\{\s*[\w.]+\s*\}/g, ' ');

// Text a reader actually sees: placeholders removed, plural branches flattened.
function visibleText(message) {
  let out = '';
  let i = 0;
  while (i < message.length) {
    if (message[i] !== '{') { out += message[i++]; continue; }
    const end = closing(message, i);
    const inner = message.slice(i + 1, end);
    const parts = inner.split(',');
    if (parts.length >= 3 && parts[1].trim() === 'plural') {
      const body = inner.slice(inner.indexOf(',', inner.indexOf(',') + 1) + 1);
      out += ' ' + Object.values(parseBranches(body)).map(visibleText).join(' ') + ' ';
    } else out += ' ';
    i = end + 1;
  }
  return stripPlaceholders(out).replace(/#/g, ' ');
}

function closing(text, open) {
  let depth = 0;
  for (let j = open; j < text.length; j++) {
    if (text[j] === '{') depth++;
    else if (text[j] === '}' && --depth === 0) return j;
  }
  throw new Error('unbalanced braces');
}

// Collect argument names and plural branch selectors.
export function analyse(message) {
  const args = new Set();
  const plurals = {};
  (function walk(m) {
    let i = 0;
    while (i < m.length) {
      if (m[i] !== '{') { i++; continue; }
      const end = closing(m, i);
      const inner = m.slice(i + 1, end);
      const c1 = inner.indexOf(',');
      if (c1 === -1) args.add(inner.trim());
      else {
        const name = inner.slice(0, c1).trim();
        const rest = inner.slice(c1 + 1);
        const c2 = rest.indexOf(',');
        const type = rest.slice(0, c2).trim();
        args.add(name);
        if (type === 'plural') {
          const branches = parseBranches(rest.slice(c2 + 1));
          plurals[name] = Object.keys(branches);
          Object.values(branches).forEach(walk);
        }
      }
      i = end + 1;
    }
  })(message);
  return { args, plurals };
}

// ---------- the check ----------

export function checkLocales({ base, target, baseName, targetName, glossary, config = DEFAULT_CONFIG }) {
  const findings = [];
  const add = (level, code, key, message) => findings.push({ level, code, key, locale: targetName, message });

  for (const key of Object.keys(base)) {
    if (!(key in target)) add('error', 'E1 missing-key', key, `"${key}" exists in ${baseName} but is missing in ${targetName}.`);
  }
  for (const key of Object.keys(target)) {
    if (!(key in base)) add('error', 'E2 extra-key', key, `"${key}" exists in ${targetName} but not in ${baseName}. Typo or leftover?`);
  }

  for (const key of Object.keys(base)) {
    if (!(key in target)) continue;
    const en = base[key];
    const fr = target[key];
    let a, b;
    try { a = analyse(en); b = analyse(fr); }
    catch (e) { add('error', 'E7 syntax', key, `Cannot parse message: ${e.message}`); continue; }

    const missingVars = [...a.args].filter((v) => !b.args.has(v));
    const extraVars = [...b.args].filter((v) => !a.args.has(v));
    if (missingVars.length || extraVars.length) {
      add('error', 'E3 placeholder', key,
        `Variables differ. Missing in ${targetName}: [${missingVars.join(', ')}]. Unexpected: [${extraVars.join(', ')}].`);
    }

    for (const [name, selectors] of Object.entries(b.plurals)) {
      const needed = ['one', 'other'].filter((s) => !selectors.includes(s));
      if (needed.length) add('error', 'E4 plural', key, `Plural "${name}" needs branch(es): ${needed.join(', ')}.`);
    }

    const enText = visibleText(en);
    const frText = visibleText(fr);
    for (const term of glossary) {
      if (containsTerm(enText, term.en) && term.approved.length && !term.approved.some((t) => containsTerm(frText, t))) {
        add('error', 'E5 glossary', key,
          `English says "${term.en}", so French must use "${term.approved.join('" or "')}". ${term.note}`.trim());
      }
      const hits = term.avoid.filter((bad) => containsTerm(frText, bad));
      // report "e-mail", not also "mail" inside it
      for (const bad of hits.filter((h) => !hits.some((o) => o !== h && norm(o).includes(norm(h))))) {
        add('error', 'E6 avoid-term', key, `Avoid "${bad}"; use "${term.approved.join('" or "')}". ${term.note}`.trim());
      }
    }

    if (en.trim() === fr.trim() && en.length > 3 && !config.untranslatedAllowlist.has(en)) {
      add('warning', 'W1 untranslated', key, `French is identical to English: "${fr}".`);
    }

    if (config.expansionKeyPattern.test(key)) {
      const ratio = frText.trim().length / Math.max(1, enText.trim().length);
      if (ratio > config.expansionRatio) {
        add('warning', 'W2 expansion', key,
          `French is ${Math.round(ratio * 100)}% of the English length ("${frText.trim()}"). Check the layout does not overflow.`);
      }
    }

    if (targetName.startsWith('fr')) {
      if (/[^\s\u00a0\u202f]:(\s|$)/.test(fr)) add('warning', 'W3 punctuation', key, 'Canadian French: put a non-breaking space before a colon ( : ).');
      if (/[ \u00a0\u202f][?!;]/.test(fr)) add('warning', 'W3 punctuation', key, 'Canadian French: no space before ? ! or ; .');
      if (/«(?![\u00a0\u202f])|(?<![\u00a0\u202f])»/.test(fr)) add('warning', 'W3 punctuation', key, 'Use non-breaking spaces inside « guillemets ».');
      if (/"/.test(fr)) add('warning', 'W3 punctuation', key, 'Use « guillemets » instead of straight quotes in French.');
    }
  }
  return findings;
}

// ---------- hardcoded text in HTML ----------

// Finds text between tags that a user would see but that is not rendered from a locale key.
// Mark intentional exceptions with translate="no" (brand names, codes).
export function findHardcodedText(html) {
  const findings = [];
  const blank = (m) => m.replace(/[^\n]/g, ' '); // keep line numbers stable
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, blank);
  const tagText = /<([a-zA-Z][\w-]*)([^>]*)>([^<]*)/g;
  let m;
  while ((m = tagText.exec(cleaned))) {
    const [, tag, attrs, raw] = m;
    const text = raw.replace(/\s+/g, ' ').trim();
    if (!text || !/\p{L}/u.test(text)) continue;
    if (/\bdata-i18n=/.test(attrs) || /\btranslate="no"/.test(attrs)) continue;
    if (tag.toLowerCase() === 'option' && /^[A-Z]{2,3}$/.test(text)) continue; // province codes
    const line = cleaned.slice(0, m.index + m[0].length - raw.length + raw.search(/\S/)).split('\n').length;
    findings.push({ level: 'error', code: 'E8 hardcoded-text', key: `<${tag}>`, line,
      message: `Hardcoded text "${text.length > 60 ? text.slice(0, 57) + '...' : text}". Add a key to both locale files and use data-i18n.` });
  }
  return findings;
}

// ---------- CLI ----------

function lineOf(fileText, key) {
  const idx = fileText.indexOf(`"${key}"`);
  return idx === -1 ? 1 : fileText.slice(0, idx).split('\n').length;
}

export function run({ root = ROOT, strict = false, config = DEFAULT_CONFIG, log = console.log } = {}) {
  const read = (loc) => {
    const path = resolve(root, config.localesDir, `${loc}.json`);
    const text = readFileSync(path, 'utf8');
    return { path, text, data: JSON.parse(text) };
  };
  const glossary = loadGlossary(resolve(root, config.glossary));
  const base = read(config.base);
  const all = [];

  for (const loc of config.targets) {
    const target = read(loc);
    const findings = checkLocales({ base: base.data, target: target.data, baseName: config.base, targetName: loc, glossary, config });
    for (const f of findings) {
      f.file = relative(root, f.code.startsWith('E1') ? target.path : target.path);
      f.line = lineOf(f.code.startsWith('E1') ? base.text : target.text, f.key);
      if (f.code.startsWith('E1')) f.file = relative(root, base.path);
    }
    all.push(...findings);
  }

  for (const htmlFile of config.htmlFiles ?? []) {
    const path = resolve(root, htmlFile);
    if (!existsSync(path)) continue;
    for (const f of findHardcodedText(readFileSync(path, 'utf8'))) {
      all.push({ ...f, locale: '-', file: relative(root, path) });
    }
  }

  const errors = all.filter((f) => f.level === 'error');
  const warnings = all.filter((f) => f.level === 'warning');
  const inActions = process.env.GITHUB_ACTIONS === 'true';
  const red = (s) => (inActions ? s : `\x1b[31m${s}\x1b[0m`);
  const yellow = (s) => (inActions ? s : `\x1b[33m${s}\x1b[0m`);
  const green = (s) => (inActions ? s : `\x1b[32m${s}\x1b[0m`);

  log(`i18n parity check: ${config.base} -> ${config.targets.join(', ')}  (${Object.keys(base.data).length} keys, ${glossary.length} glossary terms)\n`);
  for (const f of all) {
    const tag = f.level === 'error' ? red('ERROR  ') : yellow('WARNING');
    log(`${tag} ${f.code.padEnd(16)} ${f.key}\n        ${f.message}`);
    if (inActions) {
      const esc = (s) => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
      log(`::${f.level} file=${f.file},line=${f.line},title=${esc(f.code)}::${esc(`${f.key}: ${f.message}`)}`);
    }
  }

  const failed = errors.length > 0 || (strict && warnings.length > 0);
  log(`\n${failed ? red('FAIL') : green('PASS')}  ${errors.length} error(s), ${warnings.length} warning(s)${strict ? ' [strict]' : ''}`);

  if (inActions && process.env.GITHUB_STEP_SUMMARY) {
    const rows = all.map((f) => `| ${f.level === 'error' ? '❌' : '⚠️'} | \`${f.code}\` | \`${f.key}\` | ${f.message.replace(/\|/g, '\\|')} |`);
    appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `## EN/FR parity: ${failed ? '❌ blocked' : '✅ passed'}\n\n${errors.length} error(s), ${warnings.length} warning(s)\n\n` +
      (rows.length ? `| | Check | Key | Detail |\n|---|---|---|---|\n${rows.join('\n')}\n` : '_No findings._\n'));
  }
  return { errors, warnings, failed };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { failed } = run({ strict: process.argv.includes('--strict') });
  process.exit(failed ? 1 : 0);
}
