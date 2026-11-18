# Authentication and authorization

Login looks up a user, compares bcrypt password hash, signs an eight-hour JWT containing user id, role, and cluster head id, then sets an HttpOnly `token` cookie. Cookie options include root path, `sameSite: 'lax'`, eight-hour max age, and `secure` only when `NODE_ENV === 'production'`. Logout clears the cookie. Authentication middleware verifies the cookie JWT with `JWT_SECRET` and attaches `decoded.user` to `req.user`; it does not accept a bearer/header fallback.

Route middleware gates roles (`DD_ED`, `CLUSTER_HEAD`, `TEAM_LEAD`, `SALES_MAN`); controller/service checks further scope lead ownership and hierarchy. To-do mutations compare owner ID. Browser-stored role/name values are for UI routing/display only; they are not the authorization boundary. The JWT is not in localStorage and there is no server-side session or token revocation store. Password reset and role change therefore do not revoke existing unexpired JWTs.

Forgot/reset endpoints are public by design, use generic request messaging, and store only a SHA-256 token hash with a 30-minute expiry. Email dry-run logging behavior is a security finding; see security audit. CORS credentials and SameSite cookie behavior should be assessed alongside actual deployed origin and proxy configuration. No explicit CSRF token/origin validation or rate limiting is visible.
