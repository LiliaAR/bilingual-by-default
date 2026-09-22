// Minimal, dependency-free i18n runtime.
// Supports the subset of ICU MessageFormat this app needs:
//   {name}                                  simple substitution
//   {count, plural, =0 {...} one {...} other {...}}   plural with exact matches
//   #  inside a plural branch               the locale-formatted number
//
// Plural categories come from Intl.PluralRules, so French and English differ correctly:
//   en-CA: 0 -> "other"  ("0 documents")
//   fr-CA: 0 -> "one"    ("0 document")   <- the bug naive `count === 1` code gets wrong

export const SUPPORTED_LOCALES = ['en-CA', 'fr-CA'];

export function createTranslator(locale, messages) {
  const pluralRules = new Intl.PluralRules(locale);
  const numberFormat = new Intl.NumberFormat(locale);

  function t(key, vars = {}) {
    const message = messages[key];
    if (message === undefined) {
      // Visible in dev, never silently falls back to English.
      return `⟦missing: ${key}⟧`;
    }
    return formatMessage(message, vars, { pluralRules, numberFormat });
  }

  t.locale = locale;
  t.currency = (amount) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'CAD' }).format(amount);
  t.date = (date) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(date);

  return t;
}

export function formatMessage(message, vars, ctx) {
  let out = '';
  let i = 0;
  while (i < message.length) {
    const ch = message[i];
    if (ch !== '{') {
      out += ch;
      i++;
      continue;
    }
    const end = findClosingBrace(message, i);
    const inner = message.slice(i + 1, end);
    out += formatArgument(inner, vars, ctx);
    i = end + 1;
  }
  return out;
}

function formatArgument(inner, vars, ctx) {
  const firstComma = inner.indexOf(',');
  if (firstComma === -1) {
    const name = inner.trim();
    return name in vars ? String(vars[name]) : `{${name}}`;
  }
  const name = inner.slice(0, firstComma).trim();
  const rest = inner.slice(firstComma + 1);
  const secondComma = rest.indexOf(',');
  const type = rest.slice(0, secondComma).trim();
  const body = rest.slice(secondComma + 1);

  if (type !== 'plural') {
    throw new Error(`Unsupported ICU argument type "${type}" in {${inner}}`);
  }
  const value = Number(vars[name]);
  const branches = parseBranches(body);
  const exact = branches[`=${value}`];
  const category = ctx.pluralRules.select(value);
  const chosen = exact ?? branches[category] ?? branches.other;
  if (chosen === undefined) {
    throw new Error(`Plural for "${name}" has no "${category}" or "other" branch`);
  }
  const withHash = chosen.replace(/#/g, ctx.numberFormat.format(value));
  return formatMessage(withHash, vars, ctx);
}

export function parseBranches(body) {
  const branches = {};
  let i = 0;
  while (i < body.length) {
    while (i < body.length && /\s/.test(body[i])) i++;
    if (i >= body.length) break;
    let selector = '';
    while (i < body.length && body[i] !== '{' && !/\s/.test(body[i])) selector += body[i++];
    while (i < body.length && /\s/.test(body[i])) i++;
    if (body[i] !== '{') throw new Error(`Malformed plural near "${selector}"`);
    const end = findClosingBrace(body, i);
    branches[selector] = body.slice(i + 1, end);
    i = end + 1;
  }
  return branches;
}

function findClosingBrace(text, openIndex) {
  let depth = 0;
  for (let j = openIndex; j < text.length; j++) {
    if (text[j] === '{') depth++;
    else if (text[j] === '}') {
      depth--;
      if (depth === 0) return j;
    }
  }
  throw new Error(`Unbalanced braces in message: ${text}`);
}
