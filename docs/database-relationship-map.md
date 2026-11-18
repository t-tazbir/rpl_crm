# Database relationship map (from SQL foreign keys)

All edges below are defined by foreign keys in `rpl_crm.sql`, rather than inferred from query joins. A child FK that is `NOT NULL` requires a parent row; a nullable FK can be absent. Parent-to-child counts are zero-to-many where no UNIQUE constraint exists. No FK column in this schema is unique, so the database does not enforce one-to-one relationships.

```mermaid
erDiagram
    USERS {
        int id PK
        varchar name
        varchar email UK
        enum role
        int cluster_head_id FK "nullable"
        int team_lead_id FK "nullable"
    }
    LEADS {
        int id PK
        varchar lead_id UK
        int sales_rep_id FK "nullable"
        int cluster_head_id FK "nullable"
        int previous_sales_rep_id FK "nullable"
        varchar project "nullable free text"
    }
    LEAD_CONTACT_PHONES {
        int id PK
        int lead_id FK
        varchar phone_number UK
        enum contact_type
        tinyint is_primary
    }
    LEAD_ACTIVITIES {
        int id PK
        int lead_id FK
        int user_id FK "nullable"
        enum activity_type
    }
    FOLLOWUP_REMINDERS {
        int id PK
        int lead_id FK
        datetime follow_up_at
        enum status
    }
    TODOS {
        int id PK
        int sales_rep_id FK
        int lead_id FK "nullable"
    }

    USERS o|--o{ USERS : cluster_head_id
    USERS o|--o{ USERS : team_lead_id
    USERS o|--o{ LEADS : sales_rep_id
    USERS o|--o{ LEADS : cluster_head_id
    USERS o|--o{ LEADS : previous_sales_rep_id
    LEADS ||--o{ LEAD_CONTACT_PHONES : lead_id
    LEADS ||--o{ LEAD_ACTIVITIES : lead_id
    USERS o|--o{ LEAD_ACTIVITIES : user_id
    LEADS ||--o{ FOLLOWUP_REMINDERS : lead_id
    USERS ||--o{ TODOS : sales_rep_id
    LEADS o|--o{ TODOS : lead_id
```

## Cardinality and delete semantics

- `leads.sales_rep_id`, `cluster_head_id`, and `previous_sales_rep_id` are nullable references to `users.id`: each lead has zero or one referenced user per role; one user may be referenced by many leads. Deleting a user sets each of these lead references to NULL.
- `users.cluster_head_id` and `users.team_lead_id` are nullable self-references: each user has zero or one referenced user for each hierarchy link; a parent user can be referenced by many users. Deleting the referenced user sets the corresponding field to NULL.
- `lead_contact_phones.lead_id` is non-null: every phone row belongs to one lead; a lead can have many. Deleting a lead cascades to phone rows.
- `lead_activities.lead_id` is non-null: every activity belongs to one lead; a lead can have many. Deleting a lead cascades to activities. `user_id` is nullable, and deleting that user sets it to NULL.
- `followup_reminders.lead_id` is non-null: every reminder belongs to one lead; a lead can have many. Deleting a lead cascades to reminders.
- `todos.sales_rep_id` is non-null: every task belongs to one user; a user can have many. Deleting that user cascades to their tasks.
- `todos.lead_id` is nullable: a task may have no associated lead; a lead can be referenced by many tasks. Deleting a lead sets this field to NULL.

Every FK omits `ON UPDATE`; the dump therefore relies on MariaDB's default restrictive behavior for updates to referenced keys. There are no declared unique constraints on FK columns. Consequently, no one-to-one relationship is enforced. Other relationships suggested by application SQL but not represented as FKs (for example `leads.project` to a project catalog) are deliberately absent from this verified ERD.
