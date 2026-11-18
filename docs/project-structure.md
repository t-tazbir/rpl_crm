# Project structure

| Path | Purpose |
|---|---|
| `server.js` | Express setup, static hosting, route mounting, jobs, listener |
| `config/db.js` | MySQL promise pool |
| `routes/` | Auth, lead, dashboard, user, and to-do route declarations |
| `controllers/` | Request handling, SQL, validations, workflows, JSON responses |
| `services/` | Lead access, reminders, activity insertion, SMTP, WhatsApp |
| `middleware/` | JWT authentication, role gate, profile upload |
| `jobs/` | Reminder dispatch and stale lead unassignment schedules |
| `public/` | Login/recovery pages, lead workspace, dashboards, toast helper, runtime uploads |
| `.github/workflows/deploy.yml` | Build/push image and SSH deployment on main push |
| `Dockerfile` | Node 24 Alpine production image |
| `package.json`, lock | Runtime/development dependencies and scripts |
| `README.md`, `AGENTS.md`, `docs/` | Setup and technical documentation |

Standalone maintenance script `update-pass.js` is ignored by Git and is not an application entry point; do not execute it. `node_modules/` and `.env` are local/runtime material, not source documentation inputs. No schema or migration directory is present in the repository file inventory.
