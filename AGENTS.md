# RPL CRM contributor guide

Use this file as persistent repository context. The detailed source survey is in [`docs/`](docs/README.md); read the relevant topic before making a change. Verify source rather than treating documentation as more authoritative than implementation. The live schema and deployed runtime setup are external and cannot be established from this repository.

## Project overview and stack

RPL CRM is a browser-based lead and sales-team coordination application. A CommonJS Node.js process runs Express 5, serves static files from `public/`, exposes JSON APIs under `/api`, uses MySQL through `mysql2/promise`, and starts two in-process cron jobs. Browser pages are standalone HTML with inline JavaScript; there is no frontend build system. Docker uses Node 24 Alpine. Runtime packages include bcryptjs, jsonwebtoken, multer, node-cron, nodemailer, axios, cors, cookie-parser, and dotenv.

Operational entry point is `server.js` (`npm start`); development uses `nodemon server.js`. `package.json` currently declares `main: index.js`, but no `index.js` exists. Do not execute `update-pass.js`; it is a hazardous ignored maintenance script with an embedded password reset.

## Directory conventions

- `server.js`: app composition and listener.
- `config/`: shared MySQL pool.
- `routes/`: URL and middleware composition.
- `controllers/`: request handling, SQL, validation, business logic, response mapping.
- `services/`: selected shared operations and external integrations.
- `middleware/`: authentication, role checks, file upload.
- `jobs/`: scheduled work in the web process.
- `public/`: static HTML, inline scripts, shared toast helper, runtime profile uploads.
- `docs/`: source-based architecture, API, schema evidence, deployment, and audit documentation.

Preserve CommonJS and existing module placement unless explicitly authorized to change architecture. Match local style; no formatter/linter configuration is present.

## Database conventions

Use the shared `config/db.js` pool and parameterized `mysql2` queries. Dynamic identifiers must come from fixed allowlists, never request input. The repository contains no DDL, migrations, or seeds: table/column assumptions in code and docs are not a verified schema. Do not infer indexes, foreign keys, types, or delete behavior. Obtain authoritative schema before schema-sensitive work. Do not run destructive SQL. Preserve transaction boundaries and assess consistency for multi-write flows.

## API and security conventions

Mount API routes under the existing prefixes (`/api/auth`, `/api/leads`, `/api/dashboard`, `/api/users`, `/api/todos`). Inspect the route, controller, service, middleware, and browser caller before changing behavior. Authenticated browser requests use cookies with `credentials: 'include'`.

Private endpoints require `authMiddleware`; role-restricted endpoints also require `roleMiddleware`. Always enforce record ownership and hierarchy in server code; hidden controls and localStorage display values are not security boundaries. JWTs are carried in the HttpOnly cookie, not localStorage or JSON. Validate and bound request fields; parameterize values; preserve update allowlists. Escape untrusted HTML output or use safe DOM APIs. Review CSRF implications if changing cookie/origin policy. Treat upload MIME as client supplied; do not assume file content is validated.

Keep `.env`, secrets, user data, and real reset links out of source, docs, and logs. Use `.env.example` for variable names only. Do not print or copy `.env` values. Environment variable names and external configuration limits are described in `docs/integrations.md` and `docs/deployment-infrastructure.md`.

## Jobs, errors, and deployment

Both cron jobs start in every application process. Account for duplicate execution before enabling multiple replicas. Profile uploads are local filesystem data and require external persistence if they must survive container replacement. Do not assume Compose, proxy/TLS, volume, health-check, or database settings; no Compose file is checked in.

Controllers generally catch and log errors locally; response shapes vary. Follow the existing API contract unless the requested scope explicitly changes it. `deploy.yml` deploys on pushes to `main`; no test/CI workflow is present despite the README claim. `npm test` is a placeholder that exits unsuccessfully. There is no automated test framework. Do not claim tests passed unless meaningful checks were explicitly requested and actually run.

## Documentation and change boundaries

When changing implementation, update the relevant `docs/` pages and this guide only when verified repository facts change. Keep uncertain behavior labeled as unknown/open question. Do not silently change schema assumptions, API behavior, deployment settings, or business rules. Read [`docs/known-issues.md`](docs/known-issues.md) and [`docs/security-audit.md`](docs/security-audit.md) for documented caveats.
