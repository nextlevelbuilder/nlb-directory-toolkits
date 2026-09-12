# System Architecture

## Overview

The `nlb-directory-toolkits` monorepo is engineered according to the **One Source of Truth / Thin Adapters** pattern:

```text
                                  ┌─────────────────────────────┐
                                  │ @nextlevelbuilder/contracts │
                                  │ (Zod schemas, 17 blocks,    │
                                  │  templates, hasher, API)    │
                                  └──────────────┬──────────────┘
                                                 │
                        ┌────────────────────────┴────────────────────────┐
                        ▼                                                 ▼
        ┌───────────────────────────────┐                 ┌───────────────────────────────┐
        │     @nextlevelbuilder/cli     │                 │     @nextlevelbuilder/mcp     │
        │  (Commander.js, ASCII preview,│                 │  (JSON-RPC 2.0, stdio +       │
        │   API client, config resolver)│                 │   Cloudflare Workers fetch)   │
        └───────────────┬───────────────┘                 └───────────────┬───────────────┘
                        │                                                 │
                        └────────────────────────┬────────────────────────┘
                                                 │
                                                 ▼
                                ┌─────────────────────────────────┐
                                │       skills/nlb-submit         │
                                │ (Standard AgentSkill for Claude │
                                │   Cursor, Codex, OpenCode)      │
                                └─────────────────────────────────┘
```

## Layer Separation

1. **Contracts (`packages/contracts`)**:
   - Zero runtime dependencies beyond `zod`.
   - Defines all data schemas, layout templates, canonical hashing, and API contracts.
   - Usable in any JavaScript/TypeScript environment (Node.js, Deno, Bun, Cloudflare Workers, Browsers).

2. **CLI (`packages/cli`)**:
   - Thin command-line adapter wrapping contracts and API client.
   - Supports human terminal interaction (ASCII box previews, syntax colors) and automated piping (`--json`).
   - Resilient configuration resolution chain with sandboxed filesystem safety.

3. **MCP (`packages/mcp`)**:
   - Model Context Protocol adapter exposing directory capabilities as structured tools.
   - Zero heavy Node-only server dependencies: uses pure Web Standard `Request` / `Response` and SSE for Cloudflare Workers portability.

4. **AgentSkill (`skills/nlb-submit`)**:
   - High-level autonomous workflow instructing AI agents how to analyze local codebases, assemble documents, validate schemas, and publish listings.
