# Phase 5: Verification, Tests & CI Convergence

- **Phase**: 5
- **Status**: pending
- **Target Files**:
  - `packages/contracts/tests/**`
  - `packages/cli/tests/**`
  - `packages/mcp/tests/**`
  - `.github/workflows/ci.yml`

## Scope & Changes

1. **Integration & Unit Testing**:
   - Contracts: Test all schemas with valid and invalid payloads.
   - CLI: Test all commands with mock API client responses, CLI flag parsing, JSON mode, and error handling.
   - MCP: Test all 15 MCP tools with simulated fetch requests, schema validations, and edge cases.
   - Cross-package build: Ensure `pnpm build` generates clean distribution bundles with TypeScript declarations.

2. **Typecheck & Lint**:
   - Run `pnpm type-check` across all workspace packages.
   - Run `pnpm test` across all workspace packages.

3. **CI Validation**:
   - Ensure GitHub Actions workflow runs cleanly on Node 20/22.

## Verification

- Command: `pnpm build && pnpm test && pnpm type-check`
- Observable: 100% tests pass, zero TypeScript compiler errors, clean build artifacts.
