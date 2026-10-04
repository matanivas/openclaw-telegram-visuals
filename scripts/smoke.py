"""Exercise real exports with SYNTHETIC test evidence; never send messages."""
import argparse
import copy
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

CHECKS = {x: "pass" for x in ("clipping", "textBoundaries", "pageOrder", "visualBalance", "controlsRemoved")}

def read(p):
    return json.loads(p.read_text())

def save(p, value):
    p.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")

def run(*args, fails=None):
    result = subprocess.run([str(a) for a in args], text=True, capture_output=True)
    if fails is not None:
        if result.returncode == 0 or fails not in result.stderr + result.stdout:
            raise RuntimeError(f"Expected failure {fails!r}: {result.stdout} {result.stderr}")
    elif result.returncode:
        raise RuntimeError(result.stderr + result.stdout)
    return result

def smoke(workspace):
    workspace = Path(workspace).expanduser().resolve()
    skill = workspace / "skills/telegram-visual-brief"
    node = shutil.which("node")
    if not node:
        raise RuntimeError("Node.js is missing")
    python = skill / "runtime/.venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    if not python.is_file():
        raise RuntimeError("Run setup-runtime.py in this workspace first")
    export = skill / "scripts/telegram-static-export.mjs"
    pdf = skill / "scripts/telegram-static-pdf.py"
    run(node, skill / "scripts/test-static-export.mjs")
    parent = workspace / ".tmp/visual-briefs"
    parent.mkdir(parents=True, exist_ok=True)
    out = Path(tempfile.mkdtemp(prefix="synthetic-smoke-", dir=parent))
    (out / "TEST_ONLY.txt").write_text("SYNTHETIC TEST EVIDENCE. No Telegram send. Inspect a fresh sample before delivery.\n")
    source = (skill / "assets/canary-success.html").read_text()
    for count in (1, 2):
        html = out / f"fixture-{count}.html"
        if count == 1:
            html.write_text(re.sub(r'<section class="second".*?</section>', '', source, flags=re.S), encoding="utf-8")
        else:
            html.write_text(source, encoding="utf-8")
        output = out / f"pages-{count}"
        run(node, export, "export", "--input", html, "--out", output)
        manifest_path = output / "artifact-manifest.json"
        manifest = read(manifest_path)
        run(node, export, "verify", "--manifest", manifest_path, fails="not delivery-ready")
        evidence = {"schemaVersion": 1, "method": "openclaw_image_tool_original", "pages": [
            {"index": p["index"], "file": p["file"], "sha256": p["sha256"], "checks": CHECKS,
             "note": "SYNTHETIC fixture evidence only; not a claim of visual inspection."} for p in manifest["pages"]]}
        evidence_path = output / "synthetic-evidence.json"
        save(evidence_path, evidence)
        run(node, export, "approve", "--manifest", manifest_path, "--inspection-evidence", evidence_path)
        run(node, export, "verify", "--manifest", manifest_path)
        approved = read(manifest_path)
        corrupt = copy.deepcopy(approved)
        corrupt["inspection"]["pages"][0]["checks"]["clipping"] = "fail"
        save(manifest_path, corrupt)
        run(node, export, "verify", "--manifest", manifest_path, fails="inspection check")
        save(manifest_path, approved)
        if count == 1:
            run(node, skill / "scripts/telegram-static-receipt.mjs", "--manifest", manifest_path,
                "--target", "synthetic-test", "--message-id", "test-only")
            receipt = read(output / "delivery-receipt.json")
            assert receipt["artifact"]["sha256"] == approved["pages"][0]["sha256"]
            assert receipt["status"] == "send_result_recorded"
        package = output / "pdf"
        run(python, pdf, "pack", "--manifest", manifest_path, "--out", package, "--filename", "synthetic-test.pdf")
        artifact_path = package / "pdf-artifact.json"
        artifact = read(artifact_path)
        assert artifact["pdf"]["pages"] == count
        run(python, pdf, "verify", "--artifact", artifact_path, fails="not ready")
        evidence["pdfSha256"] = artifact["pdf"]["sha256"]
        evidence["pages"] = [{"index": p["index"], "file": p["file"], "sha256": p["sha256"],
                              "checks": CHECKS, "note": "SYNTHETIC PDF fixture evidence only; no visual inspection claimed."}
                             for p in artifact["proofPages"]]
        pdf_evidence = package / "synthetic-evidence.json"
        save(pdf_evidence, evidence)
        run(python, pdf, "approve", "--artifact", artifact_path, "--inspection-evidence", pdf_evidence)
        run(python, pdf, "verify", "--artifact", artifact_path)
        approved_pdf = read(artifact_path)
        corrupt = copy.deepcopy(approved_pdf)
        corrupt["proofPages"] = []
        save(artifact_path, corrupt)
        run(python, pdf, "verify", "--artifact", artifact_path, fails="proof page count mismatch")
        corrupt = copy.deepcopy(approved_pdf)
        corrupt["inspection"]["pages"] = []
        save(artifact_path, corrupt)
        run(python, pdf, "verify", "--artifact", artifact_path, fails="inspection page count mismatch")
        save(artifact_path, approved_pdf)
        run(python, pdf, "receipt", "--artifact", artifact_path, "--target", "synthetic-test", "--message-id", "test-only")
        receipt = read(package / "delivery-receipt.json")
        assert receipt["artifact"]["sha256"] == artifact["pdf"]["sha256"]
        assert receipt["artifact"]["format"] == "pdf"
        page = output / approved["pages"][0]["file"]
        original = page.read_bytes()
        page.write_bytes(original + b"tamper")
        run(node, export, "verify", "--manifest", manifest_path, fails="hash mismatch")
        run(python, pdf, "verify", "--artifact", artifact_path, fails="hash mismatch")
        page.write_bytes(original)
    print(json.dumps({"status": "mechanical_checks_passed", "fixtures": str(out),
                      "visualInspection": "not_performed_by_this_test", "telegramDelivery": "not_attempted"}, indent=2))

if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--workspace", required=True)
    smoke(p.parse_args().workspace)
