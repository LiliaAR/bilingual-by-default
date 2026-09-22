# Project rules (always on)

This is a bilingual (English / Canadian French) public-facing web form. Both languages are equal. French is never an afterthought.

## Strings
- Never hardcode user-facing text in HTML or JS. Every visible string is a key in `locales/en-CA.json` **and** `locales/fr-CA.json`, added in the same change.
- In HTML, render strings with `data-i18n="key"` (or `data-i18n-title` for tooltips). In JS, use `t('key', vars)`.
- Key names: `area.element.purpose`, lowercase, dots, underscores. Buttons end in `.button`, labels in `.label`.
- Variables use ICU syntax: `{name}`. Counts use ICU plural: `{count, plural, one {# item} other {# items}}`. Never write `count === 1 ? ... : ...` in code; French treats 0 as singular.
- Format money and dates with `t.currency()` and `t.date()`. Never build them by hand.

## Canadian French
- When writing or reviewing any French text, use the `fr-ca-terminology` skill. It holds the approved glossary.
- Formal register: use « vous ».

## Before you finish
- Run `npm run check:i18n` and `npm test`. Both must pass. The same check runs on every pull request and blocks the merge.
