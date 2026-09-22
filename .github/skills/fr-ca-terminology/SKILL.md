---
name: fr-ca-terminology
description: Canadian French (fr-CA) terminology and typography for user-facing text. Use when writing, translating, or reviewing any French string, locale file, or bilingual UI text in this repository.
---

# Canadian French terminology and typography

The file `glossary.csv` in this folder is the single source of truth for approved terms. The CI check (`scripts/check-parity.mjs`) reads the same file, so if you ignore it, the pull request will be blocked.

## How to use the glossary

1. Read `glossary.csv`. Columns: `en`, `fr_ca` (approved; `|` separates acceptable alternatives), `avoid`, `note`.
2. For every English string you translate, find each glossary term it contains (whole words, case-insensitive).
3. The French string must use one of the approved `fr_ca` terms, adjusted for grammar (plural, elision, capitalization).
4. The French string must not contain any `avoid` term.
5. If a term is not in the glossary, translate it and flag it for human review. Do not invent new glossary rows yourself; propose them in the pull request description.

## Typography (Canadian usage)

| Rule | Right | Wrong |
|---|---|---|
| Non-breaking space **before** a colon | `Total : 12 $` | `Total: 12 $` |
| **No** space before `?` `!` `;` | `Prêt?` | `Prêt ?` |
| Guillemets with non-breaking spaces | `« texte »` | `"texte"` |
| Typographic apostrophe | `d’utilisation` | `d'utilisation` |
| Money: amount then `$`, decimal comma | `1 250,50 $` | `$1,250.50` |
| Dates: day month year, lowercase month | `30 octobre 2026` | `Octobre 30, 2026` |
| Sentence case for titles and buttons | `Soumettre la demande` | `Soumettre La Demande` |

Use `t.currency()` and `t.date()` for money and dates rather than typing them.

## Register

- Public-facing text uses « vous ».
- Prefer short, plain sentences. French runs 15–30% longer than English, so buttons should stay concise (e.g. `Enregistrer` rather than `Procéder à l’enregistrement`).

## Plurals

French treats 0 and 1 as singular: `0 document sélectionné`, `1 document sélectionné`, `2 documents sélectionnés`. Always use ICU plural syntax with `one` and `other` branches.

## Scope note

This glossary is a curated demo subset. For production, validate terms against TERMIUM Plus and the Translation Bureau writing tools, and have a certified translator own the glossary.
