# Lead reassignment workflow

```mermaid
flowchart TD
  A[PUT /api/leads/:leadId/transfer] --> B[auth + DD_ED/CLUSTER_HEAD role gate]
  B --> C[Load lead and current owner's cluster]
  C --> D{Target user is SALES_MAN?}
  D -->|No| X[400 invalid target]
  D -->|Yes| E{Caller CLUSTER_HEAD?}
  E -->|Yes| F{Lead and target are in caller cluster?}
  E -->|No DD_ED| G[Management may target any Sales Man]
  F -->|No| Y[403]
  F -->|Yes| G
  G --> H[UPDATE owner, cluster; clear previous owner/unassigned_at]
  H --> I[Log transfer activity]
```

The DB update and activity insertion are not one transaction. A current unassigned lead can be assigned by DD/ED; CH authorization checks current rep cluster, so an unassigned lead has no current rep cluster and fails that check. `controllers/leadController.js:transferLead`, `routes/leadRoutes.js`.
