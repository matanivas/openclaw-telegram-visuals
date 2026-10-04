# Repository maintenance

This repository packages reusable OpenClaw skills. For installation requests,
follow INSTALL.md. The canonical routing and Telegram delivery rules live in
skills/telegram-visual-brief/SKILL.md and its linked references.

Keep host paths, credentials, destinations, generated output, and runtime caches
out of published files. Preserve upstream attribution and license files. Record
changes to vendored skills in THIRD_PARTY.md. Skill changes require regenerating
bundle-manifest.json with scripts/build-manifest.py.

Test installer changes in a temporary workspace. Test rendering changes with the
smoke runner. Fixture-generated approval evidence must remain clearly synthetic;
real deliveries require actual image inspection and actual send results.
