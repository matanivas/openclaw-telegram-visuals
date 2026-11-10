# Working in this repository

- `skills/show-me` and `skills/phone-viz` share `scripts/build.mjs`, `scripts/render.mjs`, `templates/page.css` and `references/`. A fix to one belongs in the other in the same change; only `SKILL.md` and delivery differ.
- Before committing: `node --check` every script, build every `examples/*.json` with both skills, and look at the PNGs `render.mjs` makes in both themes.
- Keep the skills free of personal data: no names, paths or keys from any one user's machine.
