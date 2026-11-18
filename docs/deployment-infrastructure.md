# Deployment and infrastructure

## Checked-in configuration

`Dockerfile` uses `node:24-alpine`, works in `/app`, installs production dependencies with `npm ci --production`, copies the repository, exposes 5000, and runs `node server.js`. The server listens on `PORT` or 5000. `docker-compose.yml` is not present; networks, port publishing, environment injection, mounts, restart policy, and health checks are not established.

## Workflow

`.github/workflows/deploy.yml` triggers on pushes to `main`. It checks out source, logs into GHCR using GitHub token, builds and pushes `ghcr.io/t-tazbir/rpl_crm:v1`, then uses SSH action with VPS secrets to log into GHCR on the host, enter `/opt/apps/rpl_crm`, run `docker compose pull`, `docker compose up -d --force-recreate`, and prune images. This is deployment automation; no checked-in CI test or syntax-check workflow exists. README currently mentions `ci.yml`, which is absent.

## Runtime and operational limits

The process initializes MySQL and both cron jobs at startup. Each replica would run the same schedules, so current code assumes one application instance. Uploaded profile images are stored inside `public/uploads/profile-pictures/`; durability depends on external mounts. No health/readiness checks or explicit shutdown handling are visible. Database, SMTP, WhatsApp, TLS/reverse proxy, backup, and production secret setup depend on external configuration and cannot be verified here.
