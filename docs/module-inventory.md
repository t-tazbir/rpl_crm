# Module inventory

| Module | Purpose and key files | Tables / dependencies |
|---|---|---|
| Authentication/recovery | `authController.js`, `authRoutes.js`, login/forgot/reset HTML | `users`; bcrypt, JWT cookie, SMTP |
| Lead workspace | `leadController.js`, `leadRoutes.js`, `public/leads.html` | `leads`, reminders, activities, users, phones |
| Contacts/spouse | `leadContactController.js` | `lead_contact_phones`, `leads`; lead access service |
| Timeline | `activityController.js`, `activityLogService.js` | `lead_activities`, `leads`; lead access service |
| Dashboards/org | `dashboardController.js`, `dashboardRoutes.js`, `dashboard.html`, `cluster-portal.html` | `leads`, `users`; repeated aggregate SQL, Chart.js |
| Team/hierarchy/profile | `userController.js`, `userRoutes.js` | `users`, transactions for demotion; Multer profile upload |
| To-dos | `todoController.js`, `todoRoutes.js` | `todos`, optional `leads` join |
| Reminder job | `followupReminderJob.js`, `followupReminderService.js` | `followup_reminders`, `leads`; WhatsApp integration |
| Stale lead release | `leadUnassignJob.js` | `leads`, `followup_reminders`, `lead_activities` |
| Shared presentation | `public/js/toast.js`, inline page scripts | Browser DOM and same-origin JSON API |

These modules are implemented in a lightweight layered style. There is no separate repository/model module; controllers own much of the SQL and business workflow. The route files are the authoritative endpoint map.

Project options, locations, and categories live independently in `public/project-list.json`; `services/projectConfigService.js` uses the same file to validate projects and derive location/category server-side. The main lead page and cluster portal use dropdowns, preserve unconfigured legacy selections during edits, and submit profession/project. The owner reports `leads.profession` and `leads.project_location` are nullable columns added manually to the local database; they are not in the dump.
