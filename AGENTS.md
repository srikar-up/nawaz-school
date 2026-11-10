# Agent Notes

## Cloudflare

- When interacting with Cloudflare, use the `cf` CLI (`npx cf ...`, installed as a devDependency) unless the project has a Wrangler configuration file.

## Hosting topology (hard requirement)

The teacher PWA and the admin panel are **separate deployments on separate origins**. Never bundle
them into one Worker/Pages project and never serve one under a subpath of the other.

| Workspace     | Kind                                        | Deploy target                              | Hostname          |
| ------------- | ------------------------------------------- | ------------------------------------------ | ----------------- |
| `teacher-app` | Vite + React SPA / PWA (mobile-first)       | its own Worker serving static assets       | `teacher.<domain>` |
| `admin-panel` | Vite + React SPA / PWA (desktop-first)      | its own Worker serving static assets       | `admin.<domain>`   |
| `server`      | Express JSON API (temporary local data layer) | its own Worker (`nodejs_compat`, or port to Hono) | `api.<domain>`     |

Why separate origins:

- Each app registers its own service worker at `/`. Separate origins keep the scopes, manifests
  and install identities from colliding.
- Each app ships, rolls back and caches independently.
- Each origin can carry its own Cloudflare Access / WAF / cache policy (admin should generally be
  locked down harder than the teacher app).

Because the apps live on different origins, the API must allow both as CORS origins, and each
app's base URL for the API has to be configurable per environment (dev proxy vs. `https://api.<domain>`).
