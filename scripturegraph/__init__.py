"""Scripture Graph engine.

Deterministic Python orchestrator for an AI-maintained Obsidian scripture
knowledge graph. AI providers (Claude Code CLI, OpenAI Codex CLI) are
replaceable workers invoked by this orchestrator; they are never the boss.
"""

__version__ = "0.1.0"

ENGINE_DIRNAME = ".scripture-engine"
VAULT_DIRNAME = "Scripture Graph"
