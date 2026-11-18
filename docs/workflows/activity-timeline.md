# Activity timeline workflow

```mermaid
flowchart TD
  A[Automatic lead event or manual activity POST] --> B[Lead access check for manual request]
  B --> C[Validate activity type/description in controller]
  C --> D[INSERT lead_activities]
  D --> E[UPDATE leads.updated_at]
  E --> F[Timeline GET joins users for actor name]
```

System events may use NULL actor. Activity insert and timestamp update are separate queries. Sources: `controllers/activityController.js`, `services/activityLogService.js`, lead/user job callers.
