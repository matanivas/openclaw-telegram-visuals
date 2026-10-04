#!/usr/bin/env python3
"""Package approved Telegram page PNGs into one hash-approved PDF."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
from datetime import datetime, timezone

try:
    import fitz
    from PIL import Image, ImageChops
except ImportError as exc:
    raise SystemExit(
        "telegram-static-pdf requires PyMuPDF (fitz) and Pillow in python3"
    ) from exc

CSS_WIDTH = 390
CSS_HEIGHT = 844
PIXEL_WIDTH = 780
PIXEL_HEIGHT = 1688
REQUIRED_CHECKS = (
    "clipping",
    "textBoundaries",
    "pageOrder",
    "visualBalance",
    "controlsRemoved",
)


def fail(message: str) -> None:
    raise SystemExit(f"TELEGRAM_STATIC_PDF_FAILED: {message}")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"cannot read JSON {path}: {exc}")


def write_json_atomic(path: Path, value: dict) -> None:
    temp = path.with_name(f"{path.name}.tmp-{os.getpid()}")
    temp.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    temp.chmod(0o600)
    temp.replace(path)


def validate_source_manifest(path: Path) -> tuple[dict, Path]:
    path = path.resolve()
    manifest = read_json(path)
    if manifest.get("status") != "ready":
        fail(f"source manifest is not ready: {manifest.get('status')}")
    if manifest.get("staticOnly") is not True or manifest.get("htmlDeliveryAllowed") is not False:
        fail("source manifest does not enforce static-only delivery")
    pages = manifest.get("pages")
    inspected = manifest.get("inspection", {}).get("pages", [])
    if not isinstance(pages, list) or len(pages) < 1:
        fail("PDF packaging requires at least one approved page")
    if len(inspected) != len(pages) or len({p["index"] for p in pages}) != len(pages):
        fail("source inspection page count or indices mismatch")
    base = path.parent
    for page in pages:
        page_path = (base / page["file"]).resolve()
        if page_path.parent != base:
            fail(f"source page escapes artifact directory: {page['file']}")
        if not page_path.is_file():
            fail(f"missing source page: {page['file']}")
        if sha256_file(page_path) != page.get("sha256"):
            fail(f"source page hash mismatch: {page['file']}")
        with Image.open(page_path) as image:
            if image.size != (PIXEL_WIDTH, PIXEL_HEIGHT):
                fail(f"source page dimensions are invalid: {page['file']} {image.size}")
        proof = next((item for item in inspected if item.get("index") == page.get("index")), None)
        if not proof or proof.get("sha256") != page.get("sha256") or proof.get("file") != page.get("file"):
            fail(f"source inspection is missing or stale for page {page.get('index')}")
        if any(proof.get("checks", {}).get(c) != "pass" for c in REQUIRED_CHECKS) or len(str(proof.get("note", "")).strip()) < 12:
            fail("source inspection checks or note are missing")
    return manifest, base


def artifact_hash(pages: list[dict]) -> str:
    digest = hashlib.sha256()
    for page in pages:
        digest.update(f"{page['index']}:{page['sha256']}\n".encode())
    return digest.hexdigest()


def validate_package(path: Path, require_approval: bool) -> tuple[dict, Path]:
    path = path.resolve()
    artifact = read_json(path)
    if artifact.get("schemaVersion") != 1:
        fail("unsupported PDF artifact schema")
    if require_approval and artifact.get("status") != "ready":
        fail(f"PDF artifact is not ready: {artifact.get('status')}")
    package_dir = path.parent
    manifest_path = Path(artifact.get("sourceManifest", ""))
    manifest, _ = validate_source_manifest(manifest_path)
    if artifact.get("sourceArtifactSha256") != artifact_hash(manifest["pages"]):
        fail("PDF artifact is stale against the approved source pages")
    pdf_path = (package_dir / artifact["pdf"]["file"]).resolve()
    if pdf_path.parent != package_dir or not pdf_path.is_file():
        fail("PDF file is missing or escapes the package directory")
    if sha256_file(pdf_path) != artifact["pdf"].get("sha256"):
        fail("PDF hash mismatch")
    document = fitz.open(pdf_path)
    if len(document) != len(manifest["pages"]):
        fail("PDF page count mismatch")
    if len(artifact.get("proofPages", [])) != len(manifest["pages"]) or artifact["pdf"].get("pages") != len(manifest["pages"]):
        fail("PDF proof page count mismatch")
    for page_number, (pdf_page, source, proof) in enumerate(
        zip(document, manifest["pages"], artifact["proofPages"]), start=1
    ):
        if proof.get("index") != page_number or proof.get("sourceSha256") != source["sha256"]:
            fail("PDF proof page order or source hash mismatch")
        rect = pdf_page.rect
        if abs(rect.width - CSS_WIDTH) > 0.01 or abs(rect.height - CSS_HEIGHT) > 0.01:
            fail(f"PDF page {page_number} geometry mismatch")
        proof_path = (package_dir / proof["file"]).resolve()
        if package_dir not in proof_path.parents or not proof_path.is_file():
            fail(f"missing PDF proof page {page_number}")
        if sha256_file(proof_path) != proof.get("sha256"):
            fail(f"PDF proof hash mismatch on page {page_number}")
        with Image.open(proof_path) as rendered, Image.open(
            manifest_path.parent / source["file"]
        ) as original:
            rendered_rgb = rendered.convert("RGB")
            original_rgb = original.convert("RGB")
            if rendered_rgb.size != (PIXEL_WIDTH, PIXEL_HEIGHT):
                fail(f"PDF proof dimensions mismatch on page {page_number}")
            if ImageChops.difference(rendered_rgb, original_rgb).getbbox() is not None:
                fail(f"PDF proof differs from approved source page {page_number}")
    document.close()
    if require_approval:
        inspected = artifact.get("inspection", {}).get("pages", [])
        if len(inspected) != len(artifact["proofPages"]):
            fail("PDF inspection page count mismatch")
        for proof, evidence in zip(artifact["proofPages"], inspected):
            if any(evidence.get(k) != proof.get(k) for k in ("index", "file", "sha256")):
                fail("PDF inspection is missing or stale")
            if any(evidence.get("checks", {}).get(c) != "pass" for c in REQUIRED_CHECKS) or len(str(evidence.get("note", "")).strip()) < 12:
                fail("PDF inspection checks or note are missing")
    return artifact, package_dir


def pack(args: argparse.Namespace) -> None:
    manifest_path = Path(args.manifest).resolve()
    manifest, source_dir = validate_source_manifest(manifest_path)
    out_dir = Path(args.out).resolve()
    if not out_dir.is_absolute():
        fail("--out must be absolute")
    if out_dir.exists() and any(out_dir.iterdir()):
        fail(f"refusing non-empty output directory: {out_dir}")
    if out_dir.exists():
        out_dir.rmdir()
    staging = out_dir.with_name(f"{out_dir.name}.staging-{os.getpid()}")
    if staging.exists():
        fail(f"staging directory already exists: {staging}")
    staging.mkdir(parents=True)
    filename = args.filename
    if Path(filename).name != filename or not filename.lower().endswith(".pdf"):
        fail("--filename must be a plain .pdf filename")
    pdf_path = staging / filename
    proof_dir = staging / "pdf-proof"
    proof_dir.mkdir()
    document = fitz.open()
    try:
        for source in manifest["pages"]:
            page = document.new_page(width=CSS_WIDTH, height=CSS_HEIGHT)
            page.insert_image(
                fitz.Rect(0, 0, CSS_WIDTH, CSS_HEIGHT),
                filename=str(source_dir / source["file"]),
                keep_proportion=False,
            )
        document.set_metadata(
            {
                "title": manifest.get("title", Path(filename).stem),
                "author": "OpenClaw Telegram Visuals",
                "subject": "Static Telegram visual brief",
            }
        )
        document.save(pdf_path, garbage=4, deflate=True)
    finally:
        document.close()

    check = fitz.open(pdf_path)
    proof_pages = []
    try:
        if len(check) != len(manifest["pages"]):
            fail("generated PDF page count mismatch")
        for index, (pdf_page, source) in enumerate(
            zip(check, manifest["pages"]), start=1
        ):
            rect = pdf_page.rect
            if abs(rect.width - CSS_WIDTH) > 0.01 or abs(rect.height - CSS_HEIGHT) > 0.01:
                fail(f"generated PDF page {index} geometry mismatch")
            pix = pdf_page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
            proof_path = proof_dir / f"page-{index:02d}.png"
            pix.save(proof_path)
            with Image.open(proof_path) as rendered, Image.open(
                source_dir / source["file"]
            ) as original:
                rendered_rgb = rendered.convert("RGB")
                original_rgb = original.convert("RGB")
                if rendered_rgb.size != (PIXEL_WIDTH, PIXEL_HEIGHT):
                    fail(f"generated PDF proof dimensions mismatch on page {index}")
                if ImageChops.difference(rendered_rgb, original_rgb).getbbox() is not None:
                    fail(f"generated PDF differs from approved source page {index}")
            proof_pages.append(
                {
                    "index": index,
                    "file": f"pdf-proof/{proof_path.name}",
                    "sha256": sha256_file(proof_path),
                    "sourceFile": source["file"],
                    "sourceSha256": source["sha256"],
                }
            )
    finally:
        check.close()

    artifact = {
        "schemaVersion": 1,
        "status": "awaiting_pdf_inspection",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "sourceManifest": str(manifest_path),
        "sourceArtifactSha256": artifact_hash(manifest["pages"]),
        "pdf": {
            "file": filename,
            "sha256": sha256_file(pdf_path),
            "pages": len(manifest["pages"]),
            "widthPoints": CSS_WIDTH,
            "heightPoints": CSS_HEIGHT,
        },
        "proofPages": proof_pages,
        "inspection": {"required": True, "completed": False, "pages": []},
    }
    write_json_atomic(staging / "pdf-artifact.json", artifact)
    staging.rename(out_dir)
    print(
        json.dumps(
            {
                "status": artifact["status"],
                "artifact": str(out_dir / "pdf-artifact.json"),
                "pdf": str(out_dir / filename),
                "proofPages": [
                    str(out_dir / page["file"]) for page in proof_pages
                ],
            }
        )
    )


def approve(args: argparse.Namespace) -> None:
    artifact_path = Path(args.artifact).resolve()
    artifact, _ = validate_package(artifact_path, require_approval=False)
    if artifact.get("status") not in ("awaiting_pdf_inspection", "ready"):
        fail(f"cannot approve PDF artifact with status {artifact.get('status')}")
    evidence = read_json(Path(args.inspection_evidence).resolve())
    if evidence.get("schemaVersion") != 1 or evidence.get("method") != "openclaw_image_tool_original":
        fail("PDF evidence must use schemaVersion=1 and method=openclaw_image_tool_original")
    if evidence.get("pdfSha256") != artifact["pdf"]["sha256"]:
        fail("PDF inspection evidence is stale")
    reviewed_pages = evidence.get("pages")
    if not isinstance(reviewed_pages, list) or len(reviewed_pages) != len(artifact["proofPages"]):
        fail("PDF evidence must contain exactly one entry per proof page")
    for proof in artifact["proofPages"]:
        reviewed = next(
            (item for item in reviewed_pages if item.get("index") == proof["index"]),
            None,
        )
        if (
            not reviewed
            or reviewed.get("file") != proof["file"]
            or reviewed.get("sha256") != proof["sha256"]
        ):
            fail(f"PDF evidence is missing or stale for page {proof['index']}")
        for check in REQUIRED_CHECKS:
            if reviewed.get("checks", {}).get(check) != "pass":
                fail(f"PDF inspection check {check} failed on page {proof['index']}")
        if len(str(reviewed.get("note", "")).strip()) < 12:
            fail(f"PDF inspection note is too short on page {proof['index']}")
    artifact["status"] = "ready"
    artifact["inspection"] = {
        "required": True,
        "completed": True,
        "completedAt": datetime.now(timezone.utc).isoformat(),
        "method": "agent_visual_page_by_page",
        "evidenceFile": Path(args.inspection_evidence).name,
        "pages": reviewed_pages,
    }
    write_json_atomic(artifact_path, artifact)
    validate_package(artifact_path, require_approval=True)
    print(json.dumps({"status": "ready", "artifact": str(artifact_path), "pdf": str(artifact_path.parent / artifact["pdf"]["file"])}))


def verify(args: argparse.Namespace) -> None:
    artifact_path = Path(args.artifact).resolve()
    artifact, package_dir = validate_package(artifact_path, require_approval=True)
    print(json.dumps({"status": "ready", "artifact": str(artifact_path), "attachment": str(package_dir / artifact["pdf"]["file"]), "pages": artifact["pdf"]["pages"]}))


def receipt(args: argparse.Namespace) -> None:
    artifact, folder = validate_package(Path(args.artifact), require_approval=True)
    if not args.message_id.strip() or not args.target.strip():
        fail("A real send-result message ID and destination are required")
    record = {"schemaVersion": 1, "status": "send_result_recorded", "channel": "telegram",
              "recordedAt": datetime.now(timezone.utc).isoformat(),
              "messageId": args.message_id, "target": args.target,
              "artifact": {**artifact["pdf"], "format": "pdf"}}
    # Exclusive create: do not overwrite a previous delivery record.
    with (folder / "delivery-receipt.json").open("x", encoding="utf-8") as f:
        json.dump(record, f, indent=2)
    print(json.dumps(record))


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser()
    sub = root.add_subparsers(dest="command", required=True)
    pack_parser = sub.add_parser("pack")
    pack_parser.add_argument("--manifest", required=True)
    pack_parser.add_argument("--out", required=True)
    pack_parser.add_argument("--filename", required=True)
    approve_parser = sub.add_parser("approve")
    approve_parser.add_argument("--artifact", required=True)
    approve_parser.add_argument("--inspection-evidence", required=True)
    verify_parser = sub.add_parser("verify")
    verify_parser.add_argument("--artifact", required=True)
    receipt_parser = sub.add_parser("receipt")
    receipt_parser.add_argument("--artifact", required=True)
    receipt_parser.add_argument("--target", required=True)
    receipt_parser.add_argument("--message-id", required=True)
    return root


def main() -> None:
    args = parser().parse_args()
    if args.command == "pack":
        pack(args)
    elif args.command == "approve":
        approve(args)
    elif args.command == "verify":
        verify(args)
    elif args.command == "receipt":
        receipt(args)


if __name__ == "__main__":
    main()
