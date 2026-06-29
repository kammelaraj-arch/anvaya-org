# org.anvaya.one — Organisation Governance Platform

The **independent** governance platform for Anvaya. It owns the governed, country-specific
**guidance**, **rules** and **compliance** content, exposes the secure **dedapi** channel that the
family app (me.anvaya) consumes, and provides an admin console for organisation administrators.

It is fully standalone — no dependency on the family-app monorepo. The few shared primitives (types,
audit hash-chain, API-key crypto, governed reference seeds) are vendored under `api/src/shared/`.

## Layout

```
anvaya-org/
  api/   NestJS — governance API + dedapi provider (Postgres; Common DB + per-country cells)
  web/   Next.js — governance admin console
  infra/ deploy-org.sh (add-only deploy onto the shared box)
  .github/workflows/deploy.yml
```

## Architecture (mirrors me.anvaya's fabric topology)

- **Common control-plane DB** — org admins (owner/admin/editor/viewer), dedapi API keys, the
  tamper-evident hash-chained audit log.
- **Per-country fabric cells** — `DB India / UK / US`, each holding that country's governed guidance,
  rules and compliance notices. Routed by `OrgRegionRouter`; splitting a cell onto its own host later
  is config (`ORG_DATABASE_URL_<REGION>`), not a rewrite.
- **dedapi channel** (`/dedapi/*`, API-key authenticated) — `guidance`, `rules`, `compliance`,
  `metadata`, `validate-profile`. The single governed source me.anvaya reads; no bypass.

## Develop

```bash
pnpm install
pnpm -r typecheck && pnpm -r test && pnpm -r build
# api:  ORG_DATABASE_URL=postgres://… pnpm --filter @anvaya-org/api db:migrate
#       ORG_DATABASE_URL=…           pnpm --filter @anvaya-org/api dev      # :4100
# web:  NEXT_PUBLIC_ORG_API_URL=http://localhost:4100 pnpm --filter @anvaya-org/web dev  # :3101
```

## Configuration (env)

**api**: `ORG_COMMON_DATABASE_URL`, `ORG_DATABASE_URL_IN|UK|US` (or a single `ORG_DATABASE_URL`),
`ORG_SESSION_SECRET`, `ORG_APP_BASE`, `ORG_DEFAULT_REGION`.
**web**: `NEXT_PUBLIC_ORG_API_URL` (the dedapi/base origin, e.g. `https://dedapi.org.anvaya.one`).

## Deploy

GitHub → **Actions → "Provision & Deploy (org.anvaya.one)" → Run**. Needs repo secrets
`DEPLOY_USER` + `DEPLOY_SSH_KEY`/`DEPLOY_PASSWORD`, optional `CERTBOT_EMAIL`,
`ORG_SESSION_SECRET`, `ORG_PG_PASSWORD`. The workflow builds on the runner, ships the bundles, and
runs `infra/deploy-org.sh` which provisions the Common + per-country databases, runs migrations,
starts the `anvaya-org-api` (:4100) + `anvaya-org-web` (:3100) containers and adds the
`org.anvaya.one` + `dedapi.org.anvaya.one` vhosts (gated by `nginx -t`) with Let's Encrypt TLS.

## First run

1. Open `https://org.anvaya.one` → **create the owner** account.
2. **dedapi keys** tab → **Issue key** → copy it (shown once).
3. In me.anvaya → Admin → Configuration, add an `org_federation` source per region:
   `endpoint = https://dedapi.org.anvaya.one/dedapi`, `api_key = <the key>`.
