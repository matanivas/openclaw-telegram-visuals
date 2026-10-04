"""Preview or install a checksum-verified bundle without replacing existing skills."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path, PurePosixPath
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
START = "<!-- OPENCLAW_TELEGRAM_VISUALS:START -->"
END = "<!-- OPENCLAW_TELEGRAM_VISUALS:END -->"
BLOCK = f"""{START}
Telegram is phone-first. Use plain text for simple updates. When a visual helps
explain dense information, use `telegram-visual-brief` at
`skills/telegram-visual-brief/SKILL.md`; it owns specialist selection and validated
static delivery. Follow the user's requested format and existing permissions.
{END}"""
IGNORED = {"node_modules", ".venv", ".browsers", "__pycache__"}

def digest(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def guard(p, workspace):
    # Refuse redirected installation targets, including symlinked parents.
    if not p.resolve().is_relative_to(workspace):
        raise ValueError(f"Target escapes workspace: {p}")
    q = p
    while q != workspace:
        if q.is_symlink():
            raise ValueError(f"Refusing symlinked target: {q}")
        q = q.parent

def inventory(folder):
    result = {}
    for p in folder.rglob("*"):
        rel = p.relative_to(folder)
        if any(x in IGNORED for x in rel.parts):
            continue
        if p.is_symlink():
            raise ValueError(f"Refusing symlink in existing skill: {p}")
        if p.is_file():
            result[rel.as_posix()] = digest(p)
    return result

def install(workspace, apply=False, protocol=False):
    workspace = Path(workspace).expanduser().resolve()
    if not workspace.is_dir():
        raise ValueError("Workspace must already exist; resolve the active agent's workspace first")
    manifest = json.loads((ROOT / "bundle-manifest.json").read_text(encoding="utf-8"))
    groups = {}
    for relative, expected in manifest.items():
        parts = PurePosixPath(relative).parts
        if len(parts) < 3 or parts[0] != "skills" or any(p in ("..", ".") for p in parts):
            raise ValueError(f"Invalid manifest path: {relative}")
        src = ROOT / relative
        if not src.resolve().is_relative_to(ROOT / "skills") or src.is_symlink() or digest(src) != expected:
            raise ValueError(f"Bundle checksum mismatch: {relative}")
        groups.setdefault(parts[1], {})[PurePosixPath(*parts[2:]).as_posix()] = expected
    new = []
    for name, expected in groups.items():
        target = workspace / "skills" / name
        guard(target, workspace)
        if target.exists():
            if not target.is_dir() or inventory(target) != expected:
                raise ValueError(f"Existing skill differs; preserve it and compare before replacing: {target}")
        else:
            new.append(name)
    agents = workspace / "AGENTS.md"
    guard(agents, workspace)
    old_bytes = agents.read_bytes() if agents.exists() else b""
    old = old_bytes.decode("utf-8")
    updated = old
    if protocol:
        if START in old or END in old:
            if old.count(START) != 1 or old.count(END) != 1 or old.index(START) > old.index(END):
                raise ValueError("Malformed or repeated routing markers in AGENTS.md")
            existing = old[old.index(START):old.index(END) + len(END)]
            if existing != BLOCK:
                raise ValueError("Existing routing paragraph differs; compare before replacing")
        else:
            updated = old + ("\n\n" if old else "") + BLOCK + "\n"
    state = workspace / ".visualization-stack"
    guard(state, workspace)
    guard(state / "install.json", workspace)
    receipt = {"schemaVersion": 1, "skills": sorted(groups), "files": manifest,
               "protocol": protocol, "installedAt": datetime.now(timezone.utc).isoformat()}
    print(json.dumps({"mode": "apply" if apply else "preview", "workspace": str(workspace),
                      "newSkills": new, "unchangedSkills": sorted(set(groups) - set(new)),
                      "appendProtocol": updated != old}, indent=2))
    if not apply:
        return
    state.mkdir(exist_ok=True)
    (workspace / "skills").mkdir(exist_ok=True)
    # All conflicts and bundle checksums were checked before any skill mutation.
    for name in new:
        target = workspace / "skills" / name
        target.mkdir(exist_ok=False)
        for rel in groups[name]:
            dst = target / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / "skills" / name / rel, dst)
    if updated != old:
        if agents.exists():
            stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
            with (state / f"AGENTS.{stamp}.bak").open("xb") as f:
                f.write(old_bytes)
        # Preserve all original bytes; append only the managed paragraph.
        agents.write_bytes(old_bytes + updated[len(old):].encode("utf-8"))
    receipt_path = state / "install.json"
    if not receipt_path.exists():
        receipt_path.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print("Installed. Continue with setup-runtime.py and smoke.py; delivery is not yet verified.")

if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--workspace", required=True)
    p.add_argument("--apply", action="store_true")
    p.add_argument("--protocol", action="store_true")
    args = p.parse_args()
    try:
        install(args.workspace, args.apply, args.protocol)
    except (ValueError, OSError) as exc:
        print(f"INSTALL_FAILED: {exc}", file=sys.stderr)
        sys.exit(1)
