# Visual-first answers for coding agents

Two skills that turn a status, plan, comparison or report into a picture instead of a wall of text: one responsive HTML page (phone and computer, light and dark, right-to-left Hebrew with the Heebo font), plus PNG images for reading on a phone.

| Skill | For | Delivers |
|---|---|---|
| [`show-me`](skills/show-me/SKILL.md) | Claude Code, Codex, claude.ai | a page (published as an Artifact where that exists, otherwise opened in the browser), and PNGs when the reader says they are on their phone |
| [`phone-viz`](skills/phone-viz/SKILL.md) | OpenClaw over Telegram | PNGs as one album, plus the HTML page as a file |

Both share one engine: the agent picks a form from the job the information does (a board for state, a pipeline for an ordered chain, a timeline for time, paired bars for balance, a map for hierarchy, a quadrant for priorities, decision cards on top), writes a short JSON spec, and `build.mjs` turns it into a self-contained page. `render.mjs` photographs it with an installed Chrome or Edge and reports labels that are cut off or overlap. No npm packages; Node 22 or newer.

`show-me` also reacts to Hebrew shortcuts: a message that starts or ends with "תראי לי" asks for a page, and "אני בטלפון" adds the PNGs.

## Install

Clone the repository, then:

| Where | macOS / Linux | Windows (PowerShell) |
|---|---|---|
| Claude Code | `sh scripts/install.sh claude` | `powershell -ExecutionPolicy Bypass -File scripts\install.ps1 claude` |
| Codex | `sh scripts/install.sh codex` | `powershell -ExecutionPolicy Bypass -File scripts\install.ps1 codex` |
| OpenClaw | `sh scripts/install.sh openclaw <workspace>` | `... install.ps1 openclaw <workspace>` |
| claude.ai | zip the `skills/show-me` folder and upload it in the skills section of your settings | |

Claude Code reads `~/.claude/skills/`, Codex reads `~/.agents/skills/`. A skill already installed under the same name is moved to a `skill-backups` folder next to the skills folder, not deleted. Start a new session (or restart Codex) to pick the skill up.

## Repository

- `skills/show-me/`, `skills/phone-viz/`: the skills. Each is self-contained: `SKILL.md`, `scripts/` (build, render), `references/` (choosing a form, color and marks, the spec, the vendored diagram-design guide), `templates/`, `assets/fonts/`, `examples/`.
- `scripts/`: the installers.

## Credits and license

Original code and text: MIT (`LICENSE`). Bundled: diagram-design by Cathryn Lavery (MIT) and the Heebo font (SIL Open Font License 1.1); see `THIRD_PARTY.md`.

The earlier version of this repository (a curated bundle of OpenClaw visualization skills with a Telegram router) is kept on the branch [`v1-bundle`](https://github.com/matanivas/openclaw-telegram-visuals/tree/v1-bundle).
