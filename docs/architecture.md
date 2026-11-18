# Architecture

## Shape

One Express process composes static delivery, JSON APIs, MySQL access, and both cron jobs. Route modules bind URLs to authentication/role middleware and controller functions. Controllers commonly perform validation, SQL, business decisions, and response mapping together. Services hold selected shared access, activity, reminder, SMTP, and WhatsApp operations. There is no ORM, repository/model layer, dependency injection, frontend framework, or API client abstraction.

## Request flow

Browser HTML is served from `public/`. Inline scripts call same-origin `/api/...` endpoints with `credentials: 'include'`. Login validates credentials and puts an eight-hour JWT in an HttpOnly cookie. `cookie-parser` exposes it to authentication middleware; verified claims are attached as `req.user`. Route role gates and controller/service ownership checks scope operations. Controllers query the shared MySQL pool and return JSON; browser code renders it. In parallel, cron callbacks query/update the same database and may invoke WhatsApp.

## Data/access flow

`server.js` loads dotenv, configures CORS, JSON and cookies, serves static files, mounts five routers, starts jobs, and listens. `config/db.js` exports a pool with 10 connections. SQL is issued directly by controllers and selected services; values are generally parameterized. Some dynamic update identifiers are selected from fixed allowlists. Transactions are used for lead+phone creation, phone mutations, and Team Lead demotion; other multi-write workflows are not consistently atomic.

## Boundaries and error flow

Most controller handlers catch exceptions, log with `console.error`, then return a generic JSON error. Multer errors are mapped to 400. There is no visible centralized Express error handler, request logging/correlation, or health/readiness endpoint. Jobs independently catch errors. See API, database, and audit documents for details.
