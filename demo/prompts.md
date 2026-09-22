# Demo prompts (copy-paste on stage)

Use the SAME feature prompt in Act 1 and Act 2. The only thing that changes is the repo setup.

## Feature prompt (Acts 1 and 2), Copilot Chat in Agent mode

```
Add a "Contact preferences" section to the application form, after the supporting
documents section. It has two checkboxes: "Send me email updates about my application"
and "Send me text message reminders before the deadline", and a hint underneath:
"You can change your preferences at any time."
```

## Act 2 follow-up (optional, if time)

```
Show me the French for the new strings and explain which glossary terms you applied.
```

## Reviewer agent (end of Act 2)

Pick **i18n-reviewer** in the agent picker, then:

```
Review the changes on this branch for EN/FR parity and quality.
```

## Act 3: break it on purpose

In `locales/fr-CA.json`, delete the line for `form.contact.hint`, and change `courriel` to `e-mail` in `form.contact.email_updates.label`. Then:

```bash
npm run check:i18n
git switch -c demo/live-break
git commit -am "Break French on purpose"
git push -u origin demo/live-break
gh pr create --fill
```

If the network is slow: open the pre-made PR from `demo/broken-fr` instead.
