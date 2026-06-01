# Work Capsule Bridge Presets

June 2026

Work Capsule bridge presets are deterministic local text renderings of `work-capsule/v1` records. They prepare capsule context for reuse in another AI tool without adding provider integrations, browser permissions, backend services, analytics, cloud sync, or remote LLM calls.

## Supported Presets

- **Plain Markdown**: the existing full Work Capsule Markdown rendering.
- **Generic AI context**: a provider-neutral handoff prompt plus the capsule fields and source trace.
- **ChatGPT Project-style context**: a project-oriented rendering for manual paste into ChatGPT Project context or instructions.
- **Claude Project-style context**: a project-knowledge rendering for manual paste into Claude Project knowledge.

## Boundary

The presets do not automate ChatGPT Projects, Claude Projects, Gemini, MCP, uploads, project membership, or provider-side memory. Copying a preset is user-initiated clipboard output from local capsule data. Future provider-specific work should keep this boundary unless the product direction explicitly changes the privacy and permission model.
