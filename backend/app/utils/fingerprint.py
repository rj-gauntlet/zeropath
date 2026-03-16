"""Finding fingerprint utility for deduplication across scans.

Strategy: Hash the combination of file_path + vulnerability_type +
normalized code snippet. Normalization strips comments, whitespace,
and line numbers so that cosmetic changes don't break identity.
"""

import hashlib
import re


def normalize_code(code: str) -> str:
    """Normalize a code snippet for fingerprinting.

    Removes:
    - Single-line comments (# ...)
    - Inline comments
    - Leading/trailing whitespace per line
    - Blank lines
    - Consecutive whitespace within lines
    """
    lines = code.split("\n")
    normalized = []
    for line in lines:
        # Remove single-line comments
        line = re.sub(r"#.*$", "", line)
        # Strip whitespace
        line = line.strip()
        # Collapse multiple spaces
        line = re.sub(r"\s+", " ", line)
        # Skip empty lines
        if line:
            normalized.append(line)
    return "\n".join(normalized)


def generate_fingerprint(file_path: str, vuln_type: str, code_snippet: str) -> str:
    """Generate a deterministic fingerprint for a finding.

    Args:
        file_path: Relative path of the file within the repo
        vuln_type: Vulnerability type/category
        code_snippet: The vulnerable code excerpt

    Returns:
        A 64-character hex SHA-256 hash
    """
    normalized = normalize_code(code_snippet)
    content = f"{file_path}:{vuln_type}:{normalized}"
    return hashlib.sha256(content.encode("utf-8")).hexdigest()
