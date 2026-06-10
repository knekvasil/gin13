# ADR-0001: Colyseus as real-time execution layer, not the backend

Colyseus handles game rooms, real-time state synchronisation, and `onAuth` JWT verification for identity extraction (userId, displayName). It does **not** own persistent business data — auth issuance, leaderboard computation, and profile storage live in a separate HTTP API (same process as Option A monolith for MVP, extracted later). This avoids the common anti-pattern where Colyseus becomes tangled with persistent business logic, making it difficult to scale the API layer independently.

**Considered options:**

- **Option A — Colyseus monolith (MVP).** Express routes for auth/leaderboard mounted alongside Colyseus in one process. Fastest iteration, simplest deployment. Recommended for Phase 1.
- **Option B — Split API + game server.** Go API handles auth, leaderboard, profiles. Colyseus pure real-time. Cleaner separation, more infra. Recommended for Phase 2+ when game rules are stable.

**Selected:** Option A for MVP, with a clear path to extract Option B later.

**Consequences:** Future extraction of auth/leaderboard into a separate service will require decoupling the shared Postgres connection and client configuration. Budget time for this when scaling.
