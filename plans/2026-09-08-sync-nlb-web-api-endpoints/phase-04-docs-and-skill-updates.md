# Phase 4: Agent Skill & Documentation Updates

- **Phase**: 4
- **Status**: pending
- **Target Files**:
  - `docs/cli.md`
  - `docs/mcp.md`
  - `docs/contracts.md`
  - `skills/nlb-submit/SKILL.md`
  - `README.md`

## Scope & Changes

1. **`docs/cli.md`**:
   - Document new commands: `nlb get <slug> --markdown`, `nlb rankings`, `nlb stats`, `nlb vote`, `nlb keys`, `nlb upload`, `nlb checkout`.
   - Update `nlb submit` documentation with payment required (HTTP 402) flow and checkout links.
   - Update `nlb doctor` with health check probe documentation.

2. **`docs/mcp.md`**:
   - Document all tools including new tools: `get_product_markdown`, `get_stats`, `check_health`, `cast_vote`, `list_api_keys`, `create_api_key`, `revoke_api_key`, `upload_media`, `create_checkout`.
   - Update input schemas and examples.

3. **`docs/contracts.md`**:
   - Document all API endpoint contracts and matching types.

4. **`skills/nlb-submit/SKILL.md`**:
   - Update skill description and prompt instructions to guide AI agents in using new tools: checking directory stats, retrieving markdown for products, voting, managing API keys, and handling Polar payment flows.

5. **`README.md`**:
   - Refresh CLI command table and MCP tools list.

## Verification

- Command: Verify all code snippets in markdown files against actual exports and commands.
- Observable: Documentation is clean, comprehensive, and contains no broken links or stale command syntax.
