import { createTranslator } from './i18n.js';

const DEADLINE = new Date(2026, 9, 30); // 30 October 2026 (month is 0-based)
const ESTIMATE = 1250.5;

const params = new URLSearchParams(location.search);
let locale = params.get('lang') === 'fr' ? 'fr-CA' : 'en-CA';
if (params.has('broken')) document.body.classList.add('fixed-width'); // opening-hook demo of the overflow bug
let t;

async function load(loc) {
  const res = await fetch(`/locales/${loc}.json`);
  t = createTranslator(loc, await res.json());
  locale = loc;
  render();
}

function render() {
  document.documentElement.lang = locale;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.getElementById('deadline').textContent = t('form.deadline', { date: t.date(DEADLINE) });
  document.getElementById('estimate').textContent = t('form.estimate.label', { amount: t.currency(ESTIMATE) });
  updateFileCount();
}

function updateFileCount() {
  const count = document.getElementById('files').files.length;
  document.getElementById('file-count').textContent = t('form.upload.count', { count });
}

document.getElementById('language-toggle').addEventListener('click', (e) => {
  e.preventDefault();
  load(locale === 'en-CA' ? 'fr-CA' : 'en-CA');
});

document.getElementById('files').addEventListener('change', updateFileCount);

document.getElementById('application').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;
  const firstInvalid = [...form.querySelectorAll('[required]')].find((el) => !el.value.trim());
  const error = document.getElementById('error');
  if (firstInvalid) {
    const label = form.querySelector(`label[for="${firstInvalid.id}"] [data-i18n], label[for="${firstInvalid.id}"][data-i18n]`);
    error.textContent = t('form.error.required', { field: label ? label.textContent : firstInvalid.name });
    error.hidden = false;
    firstInvalid.focus();
    return;
  }
  error.hidden = true;
  form.hidden = true;
  document.getElementById('confirmation').hidden = false;
  document.getElementById('confirmation-body').textContent = t('confirmation.body', {
    number: 'CSB-2026-004217',
    email: form.email.value,
  });
});

load(locale);
