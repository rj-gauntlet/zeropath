"""Git service: clone repos and extract Python files.

Strategy:
- Shallow clone (depth=1) for speed — we only need the latest snapshot
- Only extract .py files — this is a Python security scanner
- Enforce file size cap (default 50KB) — skip likely auto-generated files
- Enforce file count cap (default 200) — bound scan time and LLM costs
- Report skipped files for transparency
"""

import os
import shutil
import tempfile
from dataclasses import dataclass, field

from git import Repo, GitCommandError

from app.config import settings


@dataclass
class ExtractedFile:
    """A Python file extracted from a cloned repo."""
    path: str          # Relative path within the repo
    content: str       # File contents
    size_bytes: int    # File size


@dataclass
class CloneResult:
    """Result of cloning and extracting files from a repo."""
    files: list[ExtractedFile] = field(default_factory=list)
    skipped_files: list[dict] = field(default_factory=list)  # {path, reason}
    clone_dir: str = ""
    repo_name: str = ""
    total_py_files: int = 0


class GitService:
    def __init__(
        self,
        max_file_size_kb: int = settings.MAX_FILE_SIZE_KB,
        max_files: int = settings.MAX_FILES_PER_SCAN,
        clone_base_dir: str = settings.CLONED_REPOS_DIR,
    ):
        self.max_file_size_bytes = max_file_size_kb * 1024
        self.max_files = max_files
        self.clone_base_dir = clone_base_dir

    def extract_repo_name(self, url: str) -> str:
        """Extract 'owner/repo' from a git URL."""
        # Handle both HTTPS and SSH URLs
        url = url.rstrip("/").rstrip(".git")
        parts = url.split("/")
        if len(parts) >= 2:
            return f"{parts[-2]}/{parts[-1]}"
        return parts[-1] if parts else "unknown"

    def clone_and_extract(self, repo_url: str) -> CloneResult:
        """Clone a repo and extract Python files.

        Args:
            repo_url: Public git repository URL

        Returns:
            CloneResult with extracted files and skip information

        Raises:
            GitCommandError: If clone fails (bad URL, private repo, etc.)
        """
        result = CloneResult()
        result.repo_name = self.extract_repo_name(repo_url)

        # Create temp directory for the clone
        clone_dir = tempfile.mkdtemp(prefix="zeropath_")
        result.clone_dir = clone_dir

        try:
            # Shallow clone — only latest commit, no history
            Repo.clone_from(
                repo_url,
                clone_dir,
                depth=1,
                single_branch=True,
            )

            # Walk the repo and find .py files
            py_files = []
            for root, _dirs, files in os.walk(clone_dir):
                for filename in files:
                    if filename.endswith(".py"):
                        full_path = os.path.join(root, filename)
                        rel_path = os.path.relpath(full_path, clone_dir)

                        # Skip .git directory contents
                        if rel_path.startswith(".git"):
                            continue

                        py_files.append((rel_path, full_path))

            result.total_py_files = len(py_files)

            # Sort by path for deterministic ordering
            py_files.sort(key=lambda x: x[0])

            # Extract files with caps
            for rel_path, full_path in py_files:
                file_size = os.path.getsize(full_path)

                # Check file size cap
                if file_size > self.max_file_size_bytes:
                    result.skipped_files.append({
                        "path": rel_path,
                        "reason": f"File too large ({file_size // 1024}KB > {self.max_file_size_bytes // 1024}KB limit)",
                    })
                    continue

                # Check file count cap
                if len(result.files) >= self.max_files:
                    result.skipped_files.append({
                        "path": rel_path,
                        "reason": f"File count cap reached ({self.max_files} files)",
                    })
                    continue

                # Read file content
                try:
                    with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                        content = f.read()

                    # Skip empty files
                    if not content.strip():
                        result.skipped_files.append({
                            "path": rel_path,
                            "reason": "Empty file",
                        })
                        continue

                    result.files.append(ExtractedFile(
                        path=rel_path,
                        content=content,
                        size_bytes=file_size,
                    ))
                except Exception as e:
                    result.skipped_files.append({
                        "path": rel_path,
                        "reason": f"Read error: {str(e)}",
                    })

        except GitCommandError as e:
            # Clean up on clone failure
            self.cleanup(clone_dir)
            raise e

        return result

    def build_repo_summary(self, files: list[ExtractedFile]) -> str:
        """Build a structural summary of the repo for LLM context.

        Includes:
        - File tree
        - Key imports per file
        - Function/class signatures
        """
        lines = ["## Repository Structure\n"]

        # File tree
        lines.append("### Files:")
        for f in files:
            size_kb = f.size_bytes / 1024
            lines.append(f"- {f.path} ({size_kb:.1f}KB)")

        lines.append(f"\nTotal: {len(files)} Python files\n")

        # Per-file summary (imports + top-level definitions)
        lines.append("### Key Definitions:\n")
        for f in files:
            file_defs = []
            for line in f.content.split("\n"):
                stripped = line.strip()
                if stripped.startswith("import ") or stripped.startswith("from "):
                    file_defs.append(f"  {stripped}")
                elif stripped.startswith("def ") or stripped.startswith("class "):
                    # Just the signature, not the body
                    file_defs.append(f"  {stripped.split(':')[0]}:")
                elif stripped.startswith("async def "):
                    file_defs.append(f"  {stripped.split(':')[0]}:")

            if file_defs:
                lines.append(f"**{f.path}:**")
                # Limit to first 20 definitions per file
                for d in file_defs[:20]:
                    lines.append(d)
                if len(file_defs) > 20:
                    lines.append(f"  ... and {len(file_defs) - 20} more")
                lines.append("")

        return "\n".join(lines)

    @staticmethod
    def cleanup(clone_dir: str):
        """Remove a cloned repo directory."""
        try:
            if clone_dir and os.path.exists(clone_dir):
                shutil.rmtree(clone_dir, ignore_errors=True)
        except Exception:
            pass  # Best effort cleanup
