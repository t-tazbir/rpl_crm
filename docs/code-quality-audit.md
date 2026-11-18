# Code quality audit

## Observations

- Controllers combine request parsing, validation, SQL, business rules, and response serialization. Selected shared operations are services; no repository/model layer exists.
- Browser API/render logic is duplicated inline across standalone HTML pages. There is no frontend build, formatter, lint configuration, or API schema.
- Dashboard/team/org aggregation uses repeated SQL, including per-representative loops, causing query growth with organization size.
- Error responses are inconsistent. Controllers commonly catch/log locally; no centralized Express error handler, structured logger, request IDs, metrics, or health endpoint is visible.
- Transactions cover lead creation with primary phone, phone primary/add flows, and team demotion; consistency across other workflows varies.
- `package.json` declares `main: index.js`, while operational scripts use `server.js`; no `index.js` found.
- `npm test` is a placeholder that exits with failure. No automated tests were found; deploy workflow does not run checks.
- README says `.github/workflows/ci.yml` checks syntax, but only `deploy.yml` exists.

## Assessment

The current lightweight architecture fits a small single-process application and is recognizable from route/controller/service boundaries. Complexity is concentrated in controllers and inline page scripts. The largest scaling and maintenance pressure points are query multiplication, duplicated UI logic, inconsistent validation/error handling, and lack of automated regression checks. These are observations, not a proposal to replace the architecture wholesale.
