import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTranslator } from '../src/i18n.js';

const load = (loc) => JSON.parse(readFileSync(new URL(`../locales/${loc}.json`, import.meta.url), 'utf8'));
const en = createTranslator('en-CA', load('en-CA'));
const fr = createTranslator('fr-CA', load('fr-CA'));

test('English plural: 0 and 2 are "other", 1 is "one"', () => {
  assert.equal(en('form.upload.count', { count: 0 }), '0 documents selected');
  assert.equal(en('form.upload.count', { count: 1 }), '1 document selected');
  assert.equal(en('form.upload.count', { count: 2 }), '2 documents selected');
});

test('French plural: 0 AND 1 are "one" (the bug `count === 1` gets wrong)', () => {
  assert.equal(fr('form.upload.count', { count: 0 }), '0 document sélectionné');
  assert.equal(fr('form.upload.count', { count: 1 }), '1 document sélectionné');
  assert.equal(fr('form.upload.count', { count: 2 }), '2 documents sélectionnés');
});

test('currency formatting differs by locale', () => {
  assert.equal(en.currency(1250.5), '$1,250.50');
  // fr-CA: space as thousands separator, decimal comma, $ after the number
  assert.match(fr.currency(1250.5), /^1\s250,50\s\$$/u);
});

test('a missing key is visible, never silently English', () => {
  assert.equal(fr('does.not.exist'), '⟦missing: does.not.exist⟧');
});

test('substitution', () => {
  assert.equal(en('form.error.required', { field: 'Postal code' }), 'Postal code is required.');
  assert.equal(fr('form.error.required', { field: 'Code postal' }), 'Le champ « Code postal » est obligatoire.');
});
