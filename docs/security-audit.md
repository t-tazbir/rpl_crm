# Security audit

Source review only; severity is an assessment of code exposure, not evidence of exploitation. Locations are file-level to avoid implying line-precise exploitability; inspect current source before remediation.

| Severity | Affected area | Finding and evidence | Suggested remediation |
|---|---|---|---|
| High | `public/dashboard.html`, `public/cluster-portal.html` | Dynamic `innerHTML` rendering exists across user/lead/activity/aggregate data; escaping is localized and requires field-by-field confirmation. Stored XSS could act in an authenticated browser context. | Prefer text/DOM APIs or a single reviewed escaping/rendering strategy; audit every interpolation and test hostile values. |
| High | `services/emailService.js` | SMTP-unconfigured dry-run logs a reset URL, which is a short-lived credential-bearing token. | Never log raw reset URLs/tokens; log a non-sensitive event identifier. |
| High | `update-pass.js` | Ignored standalone maintenance script embeds a weak literal password and account target and directly changes DB state. | Keep it out of operational use; replace with a secured, parameterized maintenance workflow and remove literal credentials under controlled owner approval. |
| Medium | `middleware/uploadMiddleware.js` | Upload trusts client MIME and filename extension; writes directly to publicly served directory. | Verify file signatures, decode/re-encode images, constrain extensions, and consider isolated storage. |
| Medium | `server.js`, mutations | Cookie auth with SameSite Lax and CORS allowlisting has no explicit CSRF token or origin check. CORS is not a general CSRF defense. | Validate mutation origin/CSRF based on actual deployment origins and browser flow. |
| Medium | `server.js`, auth routes | No rate limiting visible on login/reset endpoints. | Add bounded throttling and monitoring appropriate to deployment. |
| Medium | `controllers/authController.js`, `middleware/authMiddleware.js` | JWT is stateless; password reset and role changes do not revoke outstanding tokens. | If immediate revocation is required, use token version/revocation strategy and test role-change semantics. |
| Medium | `controllers/*`, services/jobs | Several multi-step updates lack a transaction; failures can leave assignment/reminder/activity state inconsistent. | Define invariants and make coupled writes transactional where supported. |
| Low | `controllers/*` | Validation and response/error handling vary; some inputs are only presence-checked. | Centralize schemas/bounds incrementally without changing API contracts unintentionally. |

Positive controls visible: cookie is HttpOnly; CORS uses explicit configured origins for cross-origin credentialed requests; SQL values are generally parameterized; dynamic column names use allowlists; role and object scopes exist; password-reset responses are generic. Dependency vulnerability status was not assessed against a live advisory database. No secrets are reproduced here.
