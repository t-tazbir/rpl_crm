# Integrations

| Integration | Evidence/configuration | Behavior and limits |
|---|---|---|
| MySQL | `mysql2/promise`; `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Shared 10-connection pool; external schema required |
| SMTP | Nodemailer; `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Password reset emails; absent credentials trigger dry-run logging |
| WhatsApp Cloud API | Axios; `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_NAME` | Sends template via Graph API v20.0; missing credentials produce dry-run logging |
| Frontend CDNs | Tailwind CSS, Chart.js, Google Fonts | Browser dependency on external hosts; versions not consistently self-hosted/pinned |
| GitHub/GHCR/VPS | GitHub Actions secrets and SSH deployment | See deployment document; Compose/runtime config is external |

Internal dependencies: routes → middleware/controllers; controllers → shared DB pool and selected services; lead access/activity/reminder services support lead flows; jobs use DB/services; email and WhatsApp service settings are captured at module load. Actual provider delivery, credentials, templates, SMTP health, and remote API responses are deployment-dependent.
