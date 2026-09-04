# Deployment

VPS hosting for Postgres/Redis/`apps/api`/`apps/web` behind Caddy under PM2
(D9). `apps/assist` and the real CV never leave the laptop.

## Not internet-exposed

One operator, so there is no reason a login form is publicly reachable. Bind
`apps/web` to a Tailscale interface, or put Caddy `basic_auth` in front of
the whole hostname in addition to the app's own login — two locks, one user,
zero inconvenience. Postgres and Redis bind `127.0.0.1` only, no published
ports.

## Backups

`pg_dump` to `/var/backups/jobhunter/` — **outside the repo directory
entirely**, `age`-encrypted, 14-day retention. Never a gitignored folder
inside the repo; that is one `git add -f` from becoming exactly the kind of
committed-dump situation this project deliberately avoids.

## Secrets

`deploy/api.env`, chmod 600, owned by the service user. Never in the PM2
ecosystem file.

## First deploy (fill in once `deploy/` exists — Phase 9+)

1. Provision Postgres 18, Redis 8 on the VPS (or reuse the docker-compose
   services there, bound to loopback).
2. `deploy/api.env` from `.env.example`, secrets filled, chmod 600.
3. `pnpm deploy --filter=@jobhunter/api --prod --legacy .bundle/api`, ship
   the bundle, `pm2 start deploy/ecosystem.config.cjs`.
4. Caddy reverse-proxies `apps/web` and `apps/api`, both behind the
   allowlist described above.

Full CI → deploy job graph is in `PLAN.md` §Verification strategy.
