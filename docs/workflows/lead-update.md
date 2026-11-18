# Lead update workflow

```mermaid
flowchart TD
  A[PUT /api/leads/:id] --> B[Filter request to allowlisted columns]
  B --> C[Load lead]
  C --> D[Role/object access check]
  D --> E[UPDATE leads]
  E --> F{Follow-up/stage/status changed?}
  F -->|Yes| G[Read current date/status; sync reminder cycles]
  F -->|No| H[Compare original/current request fields]
  G --> H
  H --> I[Write applicable activity entries serially]
  I --> J[200 response]
```

This is not a transaction spanning lead, reminder, and activity changes. Editable fields are listed in `controllers/leadController.js:updateLead`; there is no lead DELETE route.
