# Guards

`JwtAuthGuard` lands in Phase 1 alongside the `users`/`profile` schema and
the single-operator login endpoint (there is no signup route). Until then
this directory is intentionally empty rather than holding a guard that
checks against a user table that doesn't exist yet. Global registration
order, once it exists, is documented in `docs/PATTERNS.md`.
