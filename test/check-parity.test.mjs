import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkLocales, loadGlossary, run } from '../scripts/check-parity.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const glossary = loadGlossary(resolve(ROOT, '.github/skills/fr-ca-terminology/glossary.csv'));
const check = (base, target) =>
  checkLocales({ base, target, baseName: 'en-CA', targetName: 'fr-CA', glossary });
const codes = (findings) => findings.map((f) => f.code.split(' ')[0]);
const noGlossary = glossary.length === 0 && 'no glossary in this repo';

test('the real locale files pass (no errors)', () => {
  const { errors } = run({ root: ROOT, log: () => {} });
  assert.deepEqual(errors, []);
});

test('E1: a key missing in French is an error', () => {
  const f = check({ 'a.b': 'Cancel' }, {});
  assert.deepEqual(codes(f), ['E1']);
});

test('E2: an orphan French key is an error', () => {
  const f = check({}, { 'a.b': 'Annuler' });
  assert.deepEqual(codes(f), ['E2']);
});

test('E3: placeholders must match', () => {
  const f = check({ k: 'Hello {name}' }, { k: 'Bonjour {nom}' });
  assert.ok(codes(f).includes('E3'));
});

test('E4: French plural needs one and other', () => {
  const f = check(
    { k: '{count, plural, one {# file} other {# files}}' },
    { k: '{count, plural, other {# fichiers}}' },
  );
  assert.ok(codes(f).includes('E4'));
});

test('E5: glossary term must be used (email -> courriel)', { skip: noGlossary }, () => {
  const f = check({ k: 'Email address' }, { k: 'Adresse e-mail' });
  assert.ok(codes(f).includes('E5'));
  assert.ok(codes(f).includes('E6'));
});

test('E5: "application" must become "demande", not "application"', { skip: noGlossary }, () => {
  const f = check({ k: 'Submit application' }, { k: 'Soumettre l’application' });
  assert.ok(codes(f).includes('E5'));
  assert.ok(codes(f).includes('E6'));
});

test('curly and straight apostrophes are treated the same', () => {
  const f = check({ k: 'Social Insurance Number' }, { k: "Numéro d'assurance sociale" });
  assert.deepEqual(f, []);
});

test('a placeholder named {email} is not mistaken for the word email', () => {
  const f = check({ k: 'Sent to {email}.' }, { k: 'Envoyé à {email}.' });
  assert.deepEqual(f, []);
});

test('glossary matching is whole-word and accent-aware', { skip: noGlossary }, () => {
  // "prestation" contains no "benefit" issue; "bénéfice" must be flagged
  const f = check({ k: 'Your benefit' }, { k: 'Votre bénéfice' });
  assert.ok(codes(f).includes('E6'));
});

test('W1: untranslated French is a warning', () => {
  const f = check({ k: 'Upload complete' }, { k: 'Upload complete' });
  assert.ok(codes(f).includes('W1'));
});

test('W2: long French button text is a warning', () => {
  const f = check({ 'x.button': 'Go' }, { 'x.button': 'Poursuivre' });
  assert.ok(codes(f).includes('W2'));
});

test('W3: Canadian French typography', () => {
  assert.ok(codes(check({ k: 'Total: {n}' }, { k: 'Total: {n}' })).includes('W3'));
  assert.ok(codes(check({ k: 'Ready?' }, { k: 'Prêt ?' })).includes('W3'));
  assert.ok(!codes(check({ k: 'Total: {n}' }, { k: 'Total : {n}' })).includes('W3'));
});

test('E8: hardcoded visible text in HTML is an error; data-i18n, translate="no" and comments are fine', async () => {
  const { findHardcodedText } = await import('../scripts/check-parity.mjs');
  const html = `<div>
  <p>Send me email updates</p>
  <p data-i18n="k"></p>
  <span translate="no">GitHub</span>
  <option>ON</option>
  <!-- <p>commented out</p> -->
</div>`;
  const f = findHardcodedText(html);
  assert.equal(f.length, 1);
  assert.equal(f[0].line, 2);
});
