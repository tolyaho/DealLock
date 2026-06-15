# Production Hardening Plan

This plan is ordered from highest production risk to lower-risk polish.

## P0 Security Blockers

- Fix `POST /agreements` authorization:
  - New agreement: user must have a linked wallet matching client or provider.
  - Existing agreement update: authorize against stored agreement parties.
  - Normal API users cannot overwrite chain/factory/deployment/payment fields.
  - User-editable fields are title, template, metadata JSON, contact emails, and
    last-accessed timestamp.
- Add CSRF protection for cookie-session mutating routes.
- Patch backend production dependency advisories and rerun build/tests.

## P1 Runtime Reliability

- Add SMTP timeouts.
- Move notification dispatch toward outbox flow.
- Validate env in `indexerCli`.
- Add graceful shutdown for HTTP server, indexer loop, Prisma, session pools, and
  email outbox.
- Use `SESSION_MAX_AGE_MS` from config.

## P2 Frontend Production Truth

- Treat current frontend as marketing-only until the dApp rebuild.
- Update README/deploy docs so they do not claim the active frontend can
  create/load/manage agreements unless the dApp is restored.
- Make CTAs honest.

## P3 Release And Deploy Hygiene

- Add/keep bytecode size check in CI.
- Prefer `FACTORY_V3_CONTRACTS` in production Docker docs.
- Keep V1/V2 only as legacy fallback examples.
- Require clean committed tree for deploy.
- Ignore local token/secrets files.

## P4 Lower-Risk Improvements

- Require positive integer `chainId`.
- Reject invalid `lastAccessedAt`.
- Cap metadata/contact/title sizes.
- Avoid exposing raw internal indexer errors.
- Track Spline chunk/external scene dependency as frontend performance risk.

## Test Plan

- Non-party cannot update existing agreement through `POST /agreements`.
- Party can update allowed user-editable fields.
- Existing-row chain/factory/payment fields are ignored/rejected for API users.
- CSRF rejects missing/invalid token and accepts valid token.
- Env validation fails unsafe production config.
- `indexerCli` fails fast with missing RPC/factory config.
- SMTP timeout records failure and does not hang.
- Duplicate notification logs remain idempotent.
- Run backend build/tests/indexer integration.
- Run contracts bytecode check.
- Run frontend production build.
