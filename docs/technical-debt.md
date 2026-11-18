# Technical debt and risks

- No source-controlled schema/migration/seed workflow; manual provisioning and unknown deployed constraints.
- No automated tests; test script intentionally fails and deployment does not run tests or syntax checks.
- Controllers mix SQL, validation, workflow rules, and response mapping; frontend logic is duplicated.
- Dashboard/org data uses repeated aggregates and N+1-style queries; lead/activity pagination is not visible.
- Multi-step operations are inconsistently transactional; generated lead ID reads latest then inserts and can race absent database guarantees.
- Cron jobs are in every web process; multi-replica deployment can duplicate sends and lead release operations.
- JWT role claims remain valid until expiration after role/password change; no session revocation.
- Uploads are local and public; persistence depends on external volume and content verification is absent.
- Logging is unstructured; reset dry-run can log secret-bearing URLs and operational logs have no configured policy here.
- No health/readiness, explicit graceful shutdown, or visible production observability.
- `package.json` main metadata points to missing `index.js`; README references a missing CI workflow.
- External CDN assets and deployment Compose/runtime controls are not pinned or in repository.
