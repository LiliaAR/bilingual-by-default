---
applyTo: "locales/**/*.json"
---

# Rules for locale files

- `en-CA.json` and `fr-CA.json` must always have exactly the same keys, in the same order.
- Every `{variable}` in English must appear in French with the same name. Translate the words around it, never the variable name.
- Every French plural must have at least `one` and `other` branches.
- Write non-breaking spaces as ` ` so they are visible in review: before a colon, and inside « guillemets ».
- Use the typographic apostrophe (’) in French.
- If you are unsure of a term, check the `fr-ca-terminology` skill glossary. If the term is not there, write your best translation and add `(à valider)` to the pull request description for that key, so a human translator reviews it.
