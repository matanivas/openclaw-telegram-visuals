import importlib.util
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("installer", ROOT / "scripts/install.py")
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


class InstallTests(unittest.TestCase):
    def test_preview_is_read_only(self):
        with tempfile.TemporaryDirectory() as d:
            installer.install(d, protocol=True)
            self.assertEqual(list(Path(d).iterdir()), [])

    def test_install_preserves_instructions_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            original = b"# Existing instructions\r\nKeep my settings.\r\n"
            (root / "AGENTS.md").write_bytes(original)
            installer.install(d, apply=True, protocol=True)
            after = (root / "AGENTS.md").read_bytes()
            self.assertTrue(after.startswith(original))
            self.assertEqual(len(list((root / "skills").iterdir())), 14)
            # Generated dependencies must not be copied or treated as a collision.
            runtime = root / "skills/telegram-visual-brief/runtime/node_modules/example"
            runtime.mkdir(parents=True)
            (runtime / "test").write_text("generated")
            installer.install(d, apply=True, protocol=True)
            self.assertEqual((root / "AGENTS.md").read_bytes(), after)
            backups = list((root / ".visualization-stack").glob("AGENTS.*.bak"))
            self.assertEqual(len(backups), 1)
            self.assertEqual(backups[0].read_bytes(), original)

    def test_conflict_fails_before_any_new_skill_is_written(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            existing = root / "skills/visual-explainer"
            existing.mkdir(parents=True)
            (existing / "SKILL.md").write_text("my customization")
            with self.assertRaisesRegex(ValueError, "Existing skill differs"):
                installer.install(d, apply=True, protocol=True)
            self.assertEqual([p.name for p in (root / "skills").iterdir()], ["visual-explainer"])
            self.assertFalse((root / "AGENTS.md").exists())
            self.assertEqual((existing / "SKILL.md").read_text(), "my customization")

    def test_modified_installed_skill_is_preserved(self):
        with tempfile.TemporaryDirectory() as d:
            installer.install(d, apply=True)
            p = Path(d) / "skills/telegram-visual-brief/SKILL.md"
            p.write_text(p.read_text() + "\nCustom rule\n")
            with self.assertRaisesRegex(ValueError, "Existing skill differs"):
                installer.install(d, apply=True)
            self.assertTrue(p.read_text().endswith("Custom rule\n"))

    def test_redirected_skills_directory_is_refused(self):
        with tempfile.TemporaryDirectory() as d, tempfile.TemporaryDirectory() as external:
            root = Path(d)
            try:
                (root / "skills").symlink_to(external, target_is_directory=True)
            except OSError:
                self.skipTest("This host cannot create symlinks")
            with self.assertRaisesRegex(ValueError, "escapes|symlink"):
                installer.install(d, apply=True)
            self.assertEqual(list(Path(external).iterdir()), [])

    def test_malformed_protocol_is_refused(self):
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / "AGENTS.md").write_text(installer.START)
            with self.assertRaisesRegex(ValueError, "Malformed"):
                installer.install(d, apply=True, protocol=True)
            self.assertFalse((Path(d) / "skills").exists())


if __name__ == "__main__":
    unittest.main()
