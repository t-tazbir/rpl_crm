# Known issues and owner questions

## Verified source/documentation mismatches and caveats

- README claims `.github/workflows/ci.yml` exists and checks syntax; only `deploy.yml` is present.
- Team Lead is authorized for `/api/dashboard/my-stats`, but `getSalesRepDashboard` scopes queries to the current user ID, so it reports that user's leads only. Route comments acknowledge this behavior.
- Exact database constraints and deployed runtime configuration cannot be established because DDL and Compose configuration are absent.
- `package.json` declares `main: index.js`, but `server.js` is the operational entry point and no `index.js` was found.
- `update-pass.js` is a hazardous ignored maintenance script; it must not be executed as part of normal operation.

## Questions requiring owner confirmation

1. Can you provide authoritative MySQL DDL/schema and deployed database version so columns, indexes, FKs, and constraints can be verified?
2. Can you provide the external Compose/runtime configuration (with secrets redacted) to verify ports, proxy/TLS, volumes, health/restart policy, and replica count?
3. Should Team Lead personal dashboard metrics remain self-only or include reports?
4. Should password reset and role changes revoke existing JWTs immediately?
5. Is marking overdue reminders done the desired business policy?
6. Is production intentionally single-replica, or should cron work be coordinated across replicas?
7. What is the intended policy for phone uniqueness/caps and primary fallback if the last primary number is removed?
8. Should raw reset tokens ever be emitted in development logs, or should dry-run behavior be changed?

No changes to application behavior or infrastructure were made in this survey.
