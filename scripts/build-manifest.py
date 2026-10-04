"""Record the exact distributable skill files, excluding generated runtimes."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IGNORED = {"node_modules", ".venv", ".browsers", "__pycache__"}

def files(root):
    for p in sorted(root.rglob("*")):
        if not any(part in IGNORED for part in p.relative_to(root).parts) and p.is_file():
            if p.is_symlink():
                raise ValueError(f"Symlinks are not distributable: {p}")
            yield p

if __name__ == "__main__":
    manifest = {p.relative_to(ROOT).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
                for p in files(ROOT / "skills")}
    (ROOT / "bundle-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Recorded {len(manifest)} skill files")
