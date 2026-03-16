"""Abstract base class for LLM adapters.

Design decision: Abstraction layer allows swapping LLM providers
(OpenAI, Anthropic, local models) by implementing this interface.
Shows good architecture in the interview without over-engineering.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class LLMFinding:
    """A vulnerability finding returned by the LLM."""
    severity: str        # critical, high, medium, low
    vuln_type: str       # e.g., "SQL Injection", "Path Traversal"
    line_number: int     # Approximate line where the vulnerability starts
    code_snippet: str    # The vulnerable code excerpt
    description: str     # Short description of the vulnerability
    explanation: str     # Detailed explanation of why this is vulnerable


class BaseLLMAdapter(ABC):
    """Abstract interface for LLM-powered security analysis."""

    @abstractmethod
    async def analyze_file(
        self,
        file_path: str,
        file_content: str,
        repo_summary: str,
    ) -> list[LLMFinding]:
        """Analyze a single Python file for security vulnerabilities.

        Args:
            file_path: Relative path of the file within the repo
            file_content: Full content of the Python file
            repo_summary: Structural summary of the repo for context

        Returns:
            List of findings (may be empty if no vulnerabilities found)
        """
        pass
