# Database schema (authoritative dump)

## Evidence and scope

This document describes `rpl_crm.sql` (phpMyAdmin dump; MariaDB 10.4.32; database `rpl_crm`). It uses the six `CREATE TABLE` definitions and subsequent `ALTER TABLE` statements in the dump. Inserted data is intentionally excluded. The dump defines no triggers, procedures, views, generated columns, or standalone `CREATE INDEX` statements. Indexes and foreign keys are added in ALTER statements. `ON UPDATE` is omitted from every foreign key, so MariaDB's default `RESTRICT` behavior applies. Engine is InnoDB; charset/collation for all tables is `utf8mb4` / `utf8mb4_general_ci`.

`AUTO_INCREMENT` counters below are the values declared by the dump, not row data.

## Tables and columns

### `users`

| Column | Type | Null | Default / behavior |
|---|---|---:|---|
| `id` | int(11) | No | AUTO_INCREMENT; primary key |
| `name` | varchar(100) | No | None |
| `email` | varchar(150) | No | None; unique |
| `phone` | varchar(20) | Yes | NULL |
| `profile_picture` | varchar(255) | Yes | NULL |
| `password_hash` | varchar(255) | No | None |
| `role` | enum('DD_ED','CLUSTER_HEAD','TEAM_LEAD','SALES_MAN') | No | None |
| `designation` | varchar(100) | Yes | NULL |
| `cluster_head_id` | int(11) | Yes | NULL; FK to users.id |
| `team_lead_id` | int(11) | Yes | NULL; FK to users.id |
| `created_at` | timestamp | No | current_timestamp() |
| `updated_at` | timestamp | No | current_timestamp(); ON UPDATE current_timestamp() |
| `reset_token_hash` | varchar(64) | Yes | NULL; indexed |
| `reset_token_expires` | datetime | Yes | NULL |

Indexes: PRIMARY KEY (`id`); UNIQUE (`email`); KEY (`cluster_head_id`); KEY (`team_lead_id`); KEY `idx_users_reset_token_hash` (`reset_token_hash`). AUTO_INCREMENT=22.

### `leads`

| Column | Type | Null | Default / behavior |
|---|---|---:|---|
| `id` | int(11) | No | AUTO_INCREMENT; primary key |
| `lead_id` | varchar(20) | No | None; unique |
| `source` | enum('DSI','Hotline','DM','Internal Ref') | Yes | NULL |
| `sales_rep_id` | int(11) | Yes | NULL; FK to users.id |
| `cluster_head_id` | int(11) | Yes | NULL; FK to users.id |
| `previous_sales_rep_id` | int(11) | Yes | NULL; FK to users.id |
| `unassigned_at` | datetime | Yes | NULL |
| `lead_name` | varchar(150) | No | None |
| `lead_phone` | varchar(20) | No | None |
| `spouse_name` | varchar(150) | Yes | NULL |
| `project` | varchar(150) | Yes | NULL |
| `category` | enum('Residential','Commercial') | Yes | NULL |
| `space_size_sqft` | decimal(10,2) | Yes | NULL |
| `stage` | enum('Lead','Prospect','Priority') | No | 'Lead' |
| `client_meeting` | enum('No','Yes') | No | 'No' |
| `site_visit` | enum('No','Yes') | No | 'No' |
| `meeting_at_hq` | enum('No','Yes') | No | 'No' |
| `status` | enum('Active','Converted','Lost','On Hold') | No | 'Active' |
| `unmet_demand_reason` | varchar(150) | Yes | NULL |
| `next_follow_up` | datetime | Yes | NULL |
| `note` | text | Yes | NULL |
| `created_at` | timestamp | No | current_timestamp() |
| `updated_at` | timestamp | No | current_timestamp(); ON UPDATE current_timestamp() |

Indexes: PRIMARY KEY (`id`); UNIQUE (`lead_id`); KEY (`sales_rep_id`); KEY (`cluster_head_id`); KEY (`previous_sales_rep_id`); KEY `idx_leads_status_updated` (`status`,`updated_at`). AUTO_INCREMENT=31.

### `lead_contact_phones`

| Column | Type | Null | Default / behavior |
|---|---|---:|---|
| `id` | int(11) | No | AUTO_INCREMENT; primary key |
| `lead_id` | int(11) | No | None; FK to leads.id |
| `phone_number` | varchar(20) | No | None; globally unique |
| `contact_type` | enum('lead','spouse') | No | 'lead' |
| `is_primary` | tinyint(1) | No | 0 |
| `created_at` | timestamp | No | current_timestamp() |

Indexes: PRIMARY KEY (`id`); UNIQUE (`phone_number`); KEY (`lead_id`). AUTO_INCREMENT=44.

### `lead_activities`

| Column | Type | Null | Default / behavior |
|---|---|---:|---|
| `id` | int(11) | No | AUTO_INCREMENT; primary key |
| `lead_id` | int(11) | No | None; FK to leads.id |
| `user_id` | int(11) | Yes | NULL; FK to users.id |
| `activity_type` | enum('created','call','note','meeting','stage_change','status_change','follow_up_set','meeting_update','transfer','unassigned') | No | None |
| `description` | text | No | None |
| `created_at` | timestamp | No | current_timestamp() |

Indexes: PRIMARY KEY (`id`); KEY (`lead_id`); KEY (`user_id`). AUTO_INCREMENT=72.

### `followup_reminders`

| Column | Type | Null | Default / behavior |
|---|---|---:|---|
| `id` | int(11) | No | AUTO_INCREMENT; primary key |
| `lead_id` | int(11) | No | None; FK to leads.id |
| `follow_up_at` | datetime | No | None |
| `status` | enum('active','done','cancelled') | No | 'active' |
| `send_count` | int(11) | No | 0 |
| `last_sent_at` | datetime | Yes | NULL |
| `created_at` | timestamp | No | current_timestamp() |

Indexes: PRIMARY KEY (`id`); KEY (`lead_id`); KEY `idx_fr_status_followup` (`status`,`follow_up_at`). AUTO_INCREMENT=20.

### `todos`

| Column | Type | Null | Default / behavior |
|---|---|---:|---|
| `id` | int(11) | No | AUTO_INCREMENT; primary key |
| `sales_rep_id` | int(11) | No | None; FK to users.id |
| `lead_id` | int(11) | Yes | NULL; FK to leads.id |
| `title` | varchar(255) | No | None |
| `due_date` | date | Yes | NULL |
| `is_done` | tinyint(1) | No | 0 |
| `created_at` | timestamp | No | current_timestamp() |

Indexes: PRIMARY KEY (`id`); KEY (`sales_rep_id`); KEY (`lead_id`). AUTO_INCREMENT=19.

## Foreign keys (11)

| Constraint | Child column | Parent column | ON DELETE | ON UPDATE |
|---|---|---|---|---|
| `fr_ibfk_1` | followup_reminders.lead_id | leads.id | CASCADE | RESTRICT (default; omitted) |
| `leads_ibfk_1` | leads.sales_rep_id | users.id | SET NULL | RESTRICT (default; omitted) |
| `leads_ibfk_2` | leads.cluster_head_id | users.id | SET NULL | RESTRICT (default; omitted) |
| `leads_ibfk_3` | leads.previous_sales_rep_id | users.id | SET NULL | RESTRICT (default; omitted) |
| `la_ibfk_1` | lead_activities.lead_id | leads.id | CASCADE | RESTRICT (default; omitted) |
| `la_ibfk_2` | lead_activities.user_id | users.id | SET NULL | RESTRICT (default; omitted) |
| `lcp_ibfk_1` | lead_contact_phones.lead_id | leads.id | CASCADE | RESTRICT (default; omitted) |
| `todos_ibfk_1` | todos.sales_rep_id | users.id | CASCADE | RESTRICT (default; omitted) |
| `todos_ibfk_2` | todos.lead_id | leads.id | SET NULL | RESTRICT (default; omitted) |
| `users_ibfk_1` | users.cluster_head_id | users.id | SET NULL | RESTRICT (default; omitted) |
| `users_ibfk_2` | users.team_lead_id | users.id | SET NULL | RESTRICT (default; omitted) |

## Project field

`leads.project` is nullable `varchar(150)`, with no default, FK, index, enum, or project master table. Existing project names are stored directly as text on each lead. Application lead creation accepts a project value and update code allows the project field; dashboard aggregation groups on `leads.project`. The schema does not validate canonical names or prevent spelling variants. A future project catalog would require a compatibility/data migration plan; no such change is made here.

## Owner-reported schema additions

The project owner reports that the target local database was manually altered to add `leads.profession VARCHAR(150) NULL` and `leads.project_location VARCHAR(150) NULL`. These columns are not present in `rpl_crm.sql`; the dump table definitions above therefore remain an exact account of that dump, while the application now expects these owner-added columns. No DDL was run during this feature work.
