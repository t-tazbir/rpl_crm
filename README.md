# RPL CRM

RPL CRM is a browser-based lead and team management application. The Express server hosts the interface and JSON API, with MySQL as its data store.

## Features

- Login, logout, password reset, and forgot-password email flow.
- Lead creation, assignment, transfer, follow-up tracking, contact numbers, spouse details, and activity history.
- Role-aware views for sales representatives, team leads, cluster heads, and management (`DD_ED`).
- Personal tasks, profile editing, and profile pictures.
- Dashboard and team views for authorized roles.
- Scheduled WhatsApp follow-up reminders and automatic release of inactive leads.

## Requirements

- Node.js with npm.
- A reachable MySQL server and a database whose schema matches the tables and columns used by this application.
- SMTP credentials for password recovery email.
- WhatsApp Cloud API credentials if scheduled WhatsApp reminders should be sent.

> The repository currently has no SQL schema, migration, or seed files. Provision the expected database schema and initial user accounts separately before starting the app.

## Setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Create a `.env` file in the project root. Example:

   ```dotenv
   PORT=5000
   NODE_ENV=development
   JWT_SECRET=replace-with-a-long-random-secret

   DB_HOST=127.0.0.1
   DB_USER=your_mysql_user
   DB_PASSWORD=your_mysql_password
   DB_NAME=rpl_crm

   # Needed only when the browser UI is hosted on a different origin.
   CORS_ORIGIN=http://localhost:5000

   # Used to build password-reset links sent by email.
   FRONTEND_URL=http://localhost:5000

   SMTP_HOST=smtp.example.com
   SMTP_PORT=587
   SMTP_USER=your_smtp_user
   SMTP_PASS=your_smtp_password
   MAIL_FROM=Rangs Properties <no-reply@example.com>

   # Optional until WhatsApp reminders are configured.
   WHATSAPP_TOKEN=
   WHATSAPP_PHONE_NUMBER_ID=
   WHATSAPP_TEMPLATE_NAME=followup_reminder
   ```

   Keep real credentials in `.env`; it is excluded from Git. Use a strong, private `JWT_SECRET`. SMTP and WhatsApp settings are needed for those integrations.

3. Start the server:

   ```sh
   npm run dev
   ```

   Or run without nodemon:

   ```sh
   npm start
   ```

4. Open [http://localhost:5000](http://localhost:5000). The root URL serves the login page.

## Using the app

Sign in with an account already present in the configured database. The app routes users to the view for their role:

- **Sales Man (`SALES_MAN`)**: manage leads visible to the representative, record activity and follow-ups, and manage personal tasks/profile.
- **Team Lead (`TEAM_LEAD`)**: work with their own leads and the leads assigned to their reports, and manage team tasks/profile.
- **Cluster Head (`CLUSTER_HEAD`)**: view cluster dashboards, team members, and cluster leads; manage team leads and assignments.
- **Management (`DD_ED`)**: view company dashboards and organizational information, and manage leads across clusters.

Use the profile controls to update personal details or upload a JPG, PNG, or WEBP profile image (maximum 2 MB). The forgot-password page sends a reset link through the configured SMTP account.

Role checks are enforced by API middleware. Hiding a page or control in the browser is only a usability aid; API access still requires the appropriate authenticated role.

## Background jobs

The server starts both jobs whenever it starts:

- Follow-up reminders are checked every 10 minutes. Active reminders within four hours of their scheduled time can be sent via WhatsApp. Overdue reminders are marked done.
- Leads with no active upcoming follow-up and no updates for 120 days are automatically unassigned by the daily job (scheduled for 02:00 according to the process timezone). Their active reminder cycles are cancelled.

Run a single application instance unless you add coordination for these jobs; multiple instances would each run their own schedules.

## Project layout

```text
config/       MySQL connection pool
controllers/  API request handlers
jobs/         Scheduled background jobs
middleware/   Authentication, authorization, and uploads
public/       HTML pages, browser scripts, and uploaded images
routes/       API route definitions
services/     Reusable application and integration logic
server.js     Express application entry point
```

## Development notes

The package scripts are `npm start` and `npm run dev`. No automated test suite or database migration command is currently configured. API routes are mounted under `/api/auth`, `/api/leads`, `/api/dashboard`, `/api/users`, and `/api/todos`.

## Continuous integration

GitHub Actions runs `.github/workflows/ci.yml` on pushes and pull requests. It installs dependencies from `package-lock.json` with `npm ci` and checks the syntax of project JavaScript files. The project does not yet have an automated test suite.
