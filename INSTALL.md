# Installation procedure for an OpenClaw agent

Use this procedure when your user requests installation of this repository.
Read the repository's scripts and the router before running them. The user's
workspace instructions and permissions continue to apply.

## 1. Resolve the workspace

Find the active agent's workspace from your supplied context or a scoped
configuration lookup. The default is often `~/.openclaw/workspace`, but a custom
or multi-agent installation may use another directory. Pass that exact directory
to every `--workspace` argument. Do not print full configuration or credentials.

Clone this repository into a new checkout outside `skills/`, or use an existing
unmodified checkout. Record the commit being installed. You need Git, Python
3.10+ with pip 22.3+, Node.js 20+, and npm; use available host tools. If execution is sandboxed,
install where the agent's execution environment can actually access the files.

```bash
git clone https://github.com/matanivas/openclaw-telegram-visuals.git
cd openclaw-telegram-visuals
python3 scripts/install.py --workspace /absolute/path/to/workspace --protocol
```

The last command is a dry run. It verifies the bundled file checksums and reports
the files and protocol change it would install. Existing matching folders are
left alone; a folder with different contents is a conflict. Resolve a conflict
by comparing the existing skill with the incoming one. Preserve customized
files; do not rename, overwrite, or delete them merely to make installation pass.

## 2. Install the requested skills and protocol

When the preview is clean, apply the installation already requested by the user:

```bash
python3 scripts/install.py --workspace /absolute/path/to/workspace --protocol --apply
```

This copies all 14 skills and appends a small managed paragraph to `AGENTS.md`.
Existing content is retained and backed up if changed. It writes an installation
receipt under `.visualization-stack/`. Re-running the same install is idempotent.
The installer does not replace a skill with different contents, including on
updates. If the user wants explicit invocation only, omit `--protocol`.

## 3. Install the local rendering runtime

```bash
python3 scripts/setup-runtime.py --workspace /absolute/path/to/workspace
```

This installs a locked Playwright package and its private Chromium browser, plus PyMuPDF
and Pillow in a private Python virtual environment within the installed router.
Downloads go to npm/PyPI/Playwright sources. No global npm or Python packages or
shared browser caches are changed. A Linux host may need Chromium system libraries.
If the command reports missing OS packages, use the normal host administration
policy; this installer does not invoke sudo or silently change system packages.
Run all runtime commands in the same OS/environment that will render reports.

## 4. Verify mechanics and inspect a sample

```bash
python3 scripts/smoke.py --workspace /absolute/path/to/workspace
```

The smoke run checks real browser rendering, missing-evidence rejection,
overflow rejection, a forced export failure, and single/multiple-page PDF
packaging. Test-only inspection entries and message IDs are synthetic and never
prove delivery. It retains a sample under the workspace's `.tmp/visual-briefs/`.

For a real sample, read the installed router and its
`references/static-delivery-contract.md`. Export `assets/canary-success.html`
to a fresh directory, open and inspect every PNG, write truthful inspection
evidence, approve and verify, then pack and inspect the PDF before approving it.
If the setup request explicitly asks for a Telegram sample in the current chat,
send that one verified PDF using the existing message tool and record its actual
message ID, destination, and attachment hash. Otherwise report local readiness
without sending. A successful smoke test is not Telegram delivery validation.

## 5. Confirm discovery

Use the installed OpenClaw version's `skills list` / `skills check` commands
where available, and check the current agent's visibility/allowlist if skills
are missing. [Official skill loading documentation](https://docs.openclaw.ai/tools/skills)
describes workspace skills. Do not broaden an agent's permissions or replace its
skill allowlist automatically. Some running sessions retain their skill snapshot;
use a fresh session to verify selection. A Gateway restart is not part of setup.

Report: installation directory and commit, dependency/test results, whether the
sample was visually inspected, whether Telegram delivery was actually verified,
and any remaining capability or discovery blocker. Never request bot tokens or
private keys in chat.

## Updates and removal

Fetch and review a new repository revision, then run the installer preview.
Updates deliberately report differences instead of overwriting customizations.
Compare and back up the affected skill folders before an explicitly requested
replacement, then re-run setup and smoke checks. The receipt records the original
file hashes to help distinguish local edits. Runtime dependencies under
`telegram-visual-brief/runtime/` are generated and excluded from comparisons.

To remove the package, consult `.visualization-stack/install.json`, preserve any
edited skill files, remove only the listed package-owned folders, and remove only
the paragraph between `OPENCLAW_TELEGRAM_VISUALS` markers in `AGENTS.md`. Its
timestamped backup is for reference; restoring it wholesale could lose later edits.
