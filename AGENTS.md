# Repository guide for agents and contributors

## Project overview

RPL CRM is a CommonJS Node.js application built with Express. It serves its browser UI from `public/`, exposes JSON endpoints under `/api`, stores application data in MySQL, and runs scheduled follow-up and lead-unassignment jobs in the web process.

## Local setup

- Use Node.js and npm. Install dependencies with `npm install`.
- Configure the variables documented in `README.md` in a local `.env` file.
- Connect to a MySQL database that already has the schema and initial user accounts expected by the application. This repository does not contain schema migrations or seed scripts; do not assume an empty database can be initialized automatically.
- Start with `npm run dev` for nodemon or `npm start` for a regular server.

## Change guidance

- Keep the existing CommonJS module style (`require`/`module.exports`).
- Keep API route wiring in `routes/`, request handling in `controllers/`, reusable domain logic in `services/`, and middleware in `middleware/`.
- Protect private API routes with `authMiddleware`. Apply `roleMiddleware` to role-restricted routes; frontend visibility checks are not authorization.
- Authenticated browser requests rely on the HttpOnly `token` cookie and should include `credentials: 'include'`.
- Use parameterized SQL queries with `mysql2` rather than building queries from user-controlled strings.
- Treat `.env`, uploaded profile pictures, and other user data as local runtime data. Never commit secrets, credentials, or real customer data.
- Preserve existing database and role assumptions unless a task explicitly changes them. There are no migration or test scripts currently defined in `package.json`.
- The GitHub Actions workflow in `.github/workflows/ci.yml` installs locked dependencies and checks JavaScript syntax. Keep CI and README instructions aligned with available checks.
- Keep the README accurate when changing setup, routes, environment variables, or user-facing behavior.

## Important paths

- `server.js`: Express setup, static serving, API mounting, scheduled jobs, and port binding.
- `config/db.js`: MySQL connection pool.
- `routes/` and `controllers/`: API endpoints and request behavior.
- `services/`: access, activity, messaging, email, and reminder logic.
- `jobs/`: scheduled reminder and stale-lead processing.
- `public/`: login, dashboard, leads, and cluster portal pages.
