"""OpenAI GPT-4o-mini adapter for security analysis.

Handles:
- API calls with retry logic
- JSON response parsing with validation
- Token/context window management (GPT-4o-mini supports 128K tokens)
- Error handling for malformed responses
"""

import json
import logging

from openai import AsyncOpenAI

from app.config import settings
from app.services.llm.base import BaseLLMAdapter, LLMFinding
from app.services.llm.prompts import SYSTEM_PROMPT, build_analysis_prompt

logger = logging.getLogger(__name__)

# Max retries for malformed LLM responses
MAX_RETRIES = 2


class OpenAIAdapter(BaseLLMAdapter):
    """OpenAI-based security analysis adapter."""

    def __init__(self, api_key: str = "", model: str = ""):
        self.client = AsyncOpenAI(api_key=api_key or settings.OPENAI_API_KEY)
        self.model = model or settings.LLM_MODEL

    async def analyze_file(
        self,
        file_path: str,
        file_content: str,
        repo_summary: str,
    ) -> list[LLMFinding]:
        """Analyze a Python file using GPT-4o-mini.

        Strategy:
        - Send the file content with repo summary as context
        - Parse the JSON response into structured findings
        - Retry on malformed responses with a corrective prompt
        - Return empty list on repeated failures (skip the file)
        """
        user_prompt = build_analysis_prompt(file_path, file_content, repo_summary)

        for attempt in range(MAX_RETRIES + 1):
            try:
                response = await self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    temperature=0.1,  # Low temperature for consistent, deterministic analysis
                    response_format={"type": "json_object"},
                )

                content = response.choices[0].message.content
                if not content:
                    logger.warning(f"Empty LLM response for {file_path}")
                    return []

                return self._parse_response(content, file_path)

            except json.JSONDecodeError as e:
                logger.warning(
                    f"JSON parse error for {file_path} (attempt {attempt + 1}): {e}"
                )
                if attempt < MAX_RETRIES:
                    # Add corrective context for retry
                    user_prompt += "\n\nYour previous response was not valid JSON. Please respond with ONLY a JSON array of findings."
                    continue
                logger.error(f"Failed to parse LLM response for {file_path} after {MAX_RETRIES + 1} attempts")
                return []

            except Exception as e:
                logger.error(f"LLM API error for {file_path}: {e}")
                return []

        return []

    def _parse_response(self, content: str, file_path: str) -> list[LLMFinding]:
        """Parse the LLM's JSON response into LLMFinding objects.

        Handles:
        - Direct JSON array: [...]
        - Wrapped in object: {"findings": [...]} or {"vulnerabilities": [...]}
        - Strips markdown code fences if present
        """
        # Strip markdown code fences if present
        content = content.strip()
        if content.startswith("```"):
            lines = content.split("\n")
            content = "\n".join(lines[1:-1]) if len(lines) > 2 else content

        # Parse JSON
        data = json.loads(content)

        # Handle wrapped responses
        if isinstance(data, dict):
            # Try common wrapper keys
            for key in ["findings", "vulnerabilities", "results", "issues"]:
                if key in data:
                    data = data[key]
                    break
            else:
                # If it's a dict but no known key, treat as empty
                logger.warning(f"Unexpected JSON structure for {file_path}: {list(data.keys())}")
                return []

        if not isinstance(data, list):
            logger.warning(f"Expected JSON array for {file_path}, got {type(data)}")
            return []

        # Convert to LLMFinding objects
        findings = []
        for item in data:
            try:
                finding = LLMFinding(
                    severity=str(item.get("severity", "medium")).lower(),
                    vuln_type=str(item.get("vuln_type", "Unknown")),
                    line_number=int(item.get("line_number", 0)),
                    code_snippet=str(item.get("code_snippet", "")),
                    description=str(item.get("description", "")),
                    explanation=str(item.get("explanation", "")),
                )

                # Validate severity
                if finding.severity not in ("critical", "high", "medium", "low"):
                    finding.severity = "medium"

                # Skip findings with no useful content
                if not finding.description and not finding.code_snippet:
                    continue

                findings.append(finding)
            except (ValueError, TypeError) as e:
                logger.warning(f"Skipping malformed finding in {file_path}: {e}")
                continue

        return findings
