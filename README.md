# Bilingual by default

**EN/FR parity enforced in the repo, with GitHub Copilot.**
Demo for GitHub Copilot Dev Days.

> Copilot writes the strings. The glossary decides the words. The pipeline enforces the rules.

A small, fictional public-service application form ("Community Support Benefit") in English and Canadian French. The repo is set up so that any change made by Copilot, or by a human, cannot merge unless both languages are complete and use approved terminology.

## What is in here

| File | What it does | Who reads it |
|---|---|---|
| `.github/copilot-instructions.md` | Always-on project rules: never hardcode text, add keys to both locales, use ICU plurals | Copilot (every request) |
| `.github/instructions/locales.instructions.md` | Extra rules that apply only when editing `locales/**/*.json` | Copilot (only for those files) |
| `.github/skills/fr-ca-terminology/SKILL.md` | How to write Canadian French: glossary use, typography, register, plurals | Copilot (loaded only when French is involved) |
| `.github/skills/fr-ca-terminology/glossary.csv` | Approved terms and terms to avoid. **Single source of truth.** | Copilot (via the skill) **and** the CI check |
| `.github/agents/i18n-reviewer.agent.md` | A read-only reviewer agent for meaning, register and context | You, from the agent picker |
| `scripts/check-parity.mjs` | Deterministic gate: missing keys, variables, plurals, glossary, hardcoded HTML text, typography | CI and you (`npm run check:i18n`) |
| `.github/workflows/i18n-parity.yml` | Runs the gate on every PR, on push to main, and every weekday morning | GitHub Actions |
| `locales/en-CA.json`, `locales/fr-CA.json` | The strings | Everyone |
| `src/` | The app (plain HTML/JS, no framework) | Browser |

## Run it

Needs Node 22+. No `npm install` required: zero dependencies.

```bash
npm start                 # http://localhost:5173        (English)
                          # http://localhost:5173/?lang=fr   (French)
                          # http://localhost:5173/?lang=fr&broken=1  (the classic truncated-button bug)
npm run check:i18n        # the parity gate
npm run check:i18n:strict # warnings also fail
npm test                  # 19 tests
```

## What the gate checks

| Code | Level | Check |
|---|---|---|
| E1 | error | Key in English, missing in French |
| E2 | error | Key in French, not in English |
| E3 | error | `{variables}` differ |
| E4 | error | French plural missing `one` or `other` |
| E5 | error | English uses a glossary term; French does not use the approved term |
| E6 | error | French uses a term the glossary says to avoid |
| E7 | error | Message cannot be parsed |
| E8 | error | Visible text hardcoded in HTML (would ship English-only) |
| W1 | warning | French identical to English |
| W2 | warning | French button text much longer than English |
| W3 | warning | Canadian French typography |

## Demo branches

| Branch | Purpose |
|---|---|
| `main` | Fully set up repo |
| `demo/naive-start` | Same app, **no** Copilot customization (no instructions, skill, or agent). Start of Act 1. |
| `demo/naive-result` | What an unguided prompt typically produces: hardcoded English. Fallback if live generation is slow. |
| `demo/guided-result` | What the guided prompt should produce: keys in both locales, glossary terms. Fallback for Act 2. |
| `demo/broken-fr` | A French key deleted and two terminology errors. Open a PR from this to show the gate blocking. Fallback for Act 3. |

## Important

The glossary is a curated demo subset. Before real use, validate terms against TERMIUM Plus and the Translation Bureau's writing tools, and have a certified translator own `glossary.csv` (put it under CODEOWNERS).

Fictional program. Not affiliated with the Government of Canada.
