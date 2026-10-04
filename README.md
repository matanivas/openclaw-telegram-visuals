# OpenClaw Telegram Visuals

Phone-readable diagrams, charts, dashboards, and interface previews for OpenClaw.
One router chooses the right specialist and turns its output into an inspected
PNG or PDF for Telegram.

## Give this to your OpenClaw

> Install the visualization skills from https://github.com/matanivas/openclaw-telegram-visuals . Read INSTALL.md and follow its agent setup procedure in my active workspace. Preserve my existing skills and instructions, install the local rendering dependencies, and validate a sample. Use the included protocol to choose skills automatically. Send the sample here if this is my Telegram chat.

The agent needs filesystem and shell access on the machine where OpenClaw runs.
A link alone cannot grant those tools. Setup downloads rendering dependencies;
it uses your existing OpenClaw model and Telegram connection, with no new API key.

## What you get

| Outcome | Skill |
| --- | --- |
| Decide how to visualize and deliver | `telegram-visual-brief` |
| Explain systems, workflows, plans, and comparisons | `visual-explainer` |
| One chart / a dashboard with several views | `create-viz` / `build-dashboard` |
| Responsive app interface or prototype | `baoyu-design` |
| Custom maps, networks, hierarchies, or interactions | `d3-viz` |
| Prepare and validate numerical data | Eight supporting Anthropic Data skills |

Simple answers remain text. The [protocol](skills/telegram-visual-brief/SKILL.md)
selects one primary specialist and, when useful, one supporting specialist.
Numerical claims require real data unless you request sample data.

Telegram output is **static**: one PNG for one page, or one PDF for multiple
pages (also for an explicit PDF request). Pages are 390 × 844 CSS pixels,
rendered at 2× resolution. Interactive HTML stays available locally; Telegram
attachments do not acquire working controls or live refresh.

## Installation and maintenance

See [INSTALL.md](INSTALL.md) for the agent procedure and manual commands.
The installer previews by default, refuses conflicting skill folders, and can
append one managed routing paragraph to `AGENTS.md` with a backup. It does not
change bot credentials, models, schedules, or Gateway configuration.

Linux/WSL is the initially tested rendering environment. The installer uses
portable Python; macOS and native Windows rendering require validation on those
hosts. Optional upstream workflows such as PPTX/video export have their own
dependencies and are not installed by the Telegram setup.

## Credits and license

This is a curated integration of existing skills, with a portable Telegram
router, installer, and validation tools. It is not an official OpenClaw package.
Original integration code is MIT licensed. Bundled skills retain their own MIT
or Apache-2.0 licenses and author attribution; see
[THIRD_PARTY.md](THIRD_PARTY.md) for pinned sources and modifications.

## Development

Run `python3 -m unittest discover -s tests` for installer checks. After setting
up the router runtime, run `python3 scripts/smoke.py --workspace /path/to/workspace`
for browser export and PDF regression checks. These tests never send Telegram
messages. Automated fixture evidence is not a substitute for visually inspecting
a real delivery.
