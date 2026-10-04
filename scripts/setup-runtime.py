"""Install rendering dependencies only inside the selected workspace's router."""
import argparse
import os
from pathlib import Path
import shutil
import subprocess
import sys
import venv

def setup(workspace):
    workspace = Path(workspace).expanduser().resolve()
    runtime = workspace / "skills" / "telegram-visual-brief" / "runtime"
    if not runtime.resolve().is_relative_to(workspace) or not (runtime / "package-lock.json").is_file():
        raise ValueError("Install the bundle in this workspace first")
    for target in (runtime, runtime.parent, runtime / "node_modules", runtime / ".browsers", runtime / ".venv"):
        if target.is_symlink() or not target.resolve().is_relative_to(workspace):
            raise ValueError(f"Refusing redirected runtime target: {target}")
    npm = shutil.which("npm")
    node = shutil.which("node")
    if not npm or not node:
        raise ValueError("Node.js 20+ and npm must be available on PATH")
    major = int(subprocess.check_output([node, "--version"], text=True).strip().lstrip("v").split(".")[0])
    if major < 20:
        raise ValueError("Node.js 20+ is required")
    subprocess.run([npm, "ci", "--ignore-scripts", "--no-audit", "--no-fund"], cwd=runtime, check=True)
    browser_env = {**os.environ, "PLAYWRIGHT_BROWSERS_PATH": str(runtime / ".browsers"),
                   "PLAYWRIGHT_SKIP_BROWSER_GC": "1"}
    subprocess.run([node, str(runtime / "node_modules" / "playwright" / "cli.js"), "install", "chromium"], env=browser_env, check=True)
    env = runtime / ".venv"
    if env.is_symlink():
        raise ValueError("Refusing a symlinked runtime virtual environment")
    # pip --python can seed an isolated venv even on hosts without ensurepip.
    subprocess.run([sys.executable, "-m", "pip", "--version"], check=True, capture_output=True)
    venv.EnvBuilder(with_pip=False).create(env)
    python = env / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    subprocess.run([sys.executable, "-m", "pip", "--python", str(python), "install", "-r", str(runtime / "requirements.txt")], check=True)
    print("Runtime installed. Run smoke.py to validate the browser and PDF path.")

if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--workspace", required=True)
    try:
        setup(p.parse_args().workspace)
    except (ValueError, OSError, subprocess.CalledProcessError) as exc:
        print(f"RUNTIME_SETUP_FAILED: {exc}", file=sys.stderr)
        sys.exit(1)
