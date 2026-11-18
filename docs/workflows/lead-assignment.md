# Lead initial assignment workflow

```mermaid
flowchart TD
  A[Authenticated create request] --> B[Owner = req.user.id]
  B --> C{Role is CLUSTER_HEAD?}
  C -->|Yes| D[cluster_head_id = self]
  C -->|No| E[cluster_head_id = JWT cluster_head_id]
  D --> F[Insert lead and primary phone in transaction]
  E --> F
  F --> G[Optional reminder sync]
  G --> H[Create activity]
```

No create payload target-owner field is used: initial owner is the caller. Database FKs require referenced IDs if non-null, but do not validate hierarchy role semantics. `controllers/leadController.js:createLead`.
