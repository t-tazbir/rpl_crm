# Project overview

## Verified purpose

RPL CRM is a browser application for managing property sales leads and coordinating sales representatives through team lead, cluster head, and management roles. It includes lead intake and ownership, follow-up, contact numbers, activities, user/team administration, dashboards, personal to-dos, password recovery, and profile management. The server also runs reminder and stale-lead release jobs.

## Verified stack

CommonJS Node.js (Docker image Node 24), Express 5, MySQL via `mysql2/promise`, plain HTML and inline browser JavaScript. Dependencies include `axios`, `bcryptjs`, `cookie-parser`, `cors`, `dotenv`, `jsonwebtoken`, `multer`, `node-cron`, and `nodemailer`; `nodemon` is development-only. Tailwind CSS, Chart.js, and Google Fonts are loaded from CDNs in pages.

## Limits

No checked-in DDL, migrations, seeds, test suite, compose file, frontend build, or separate worker was found. The database layout is inferred from SQL and the live schema cannot be confirmed. Actual production secrets, mounts, proxy/TLS, and runtime environment are external. `package.json` says `main: index.js`, but scripts and Docker run `server.js` and no `index.js` is listed.
