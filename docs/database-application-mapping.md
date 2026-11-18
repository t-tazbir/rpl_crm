# Database to application mapping

This compares `rpl_crm.sql` DDL with checked-in SQL in `controllers/`, `services/`, `jobs/`, and `config/`. The owner reports local manual additions `leads.profession VARCHAR(150) NULL` and `leads.project_location VARCHAR(150) NULL`, which are absent from the dump. Application SQL using those fields depends on those external additions being present. No INSERT sample data is reproduced.

## Table usage

| Table | Application use |
|---|---|
| `users` | Auth/profile/hierarchy, lead joins and dashboard team queries |
| `leads` | Lead create/list/filter/update/transfer, reminders and dashboard aggregates |
| `lead_contact_phones` | Create/list/add/primary/delete lead and spouse numbers; phone search |
| `lead_activities` | Activity timeline and system/user event inserts |
| `followup_reminders` | Create/cancel/send/expire reminder cycles and stale-lead cleanup |
| `todos` | Per-user task list/create/update/delete with optional lead join |

## Compatibility comparison

### Matched tables and principal columns

Every table name referenced in application SQL exists in the dump. Directly referenced columns are present, including `users.team_lead_id`, `leads.previous_sales_rep_id`, `leads.space_size_sqft`, `leads.unassigned_at`, `lead_contact_phones.contact_type`, and reminder send-state fields. No definite query reference to a nonexistent table or column was found in the surveyed source.

### ENUM/value mismatches and edge cases

- **Lead status capitalization:** schema enum values are `Active`, `Converted`, `Lost`, `On Hold`; dashboard and stale-lead SQL use `'LOST'` in some comparisons, while lead logic also uses `'Lost'`/`'LOST'` conventions. Under the dump's `utf8mb4_general_ci` collation, case-insensitive matching is expected for ENUM comparisons, but this should be verified on the deployed MariaDB version. The canonical enum literal is `Lost`; application writes of an unlisted spelling may depend on SQL mode and type coercion, so validate explicitly.
- **Other ENUM values:** source-level activity types used by controllers/jobs align with declared activity enum values (`created`, `call`, `note`, `meeting`, `stage_change`, `status_change`, `follow_up_set`, `meeting_update`, `transfer`, `unassigned`). Phone types (`lead`, `spouse`) and reminder states (`active`, `done`, `cancelled`) align. Lead stage and meeting values are expected to use declared labels; creation/update validation should continue to constrain them.
- **Project:** dashboard groups by it and pages render it. Schema is nullable `varchar(150)` with no DB canonical list/FK/index. Application now validates changed project names against the JSON catalog and derives location there. Values longer than 150 are impossible through configured names but DB behavior still depends on SQL mode for other writers.
- **Unique phone behavior:** code catches `ER_DUP_ENTRY` for `phone_number`; dump confirms global unique constraint. This also means a spouse and a different lead cannot share the same number.
- **Lead phone primary invariant:** app sets `is_primary` and synchronizes `leads.lead_phone`, but schema only has ordinary `lead_id` index and global phone uniqueness. It does not enforce at most one primary per lead or correspondence between primary phone row and `leads.lead_phone`.

## Query/index mapping observations

Indexes directly support primary/unique lookups, FK joins, lead ownership/prior-owner filters, user hierarchy filters, reset-token lookup, reminder status/time selection, and stale lead status/update filtering. Potentially frequent unindexed paths include follow-up date scans (`leads.next_follow_up`), lead list stage/status combinations beyond the `(status,updated_at)` index, project dashboard grouping (`leads.project`), activities ordered by creation time (`lead_activities.created_at`), and todo ordering by `is_done`/`due_date`. Whether these are costly depends on data volume and plans; no index recommendation is conclusive without explain output.

## Integrity and transaction alignment

- Lead creation plus primary phone insertion is transactional and schema requires the phone row's lead FK to exist.
- Lead-contact primary changes/addition use transactions in several paths, but phone deletion plus fallback-primary selection is multiple operations without a transaction. Concurrent changes can leave `is_primary` or `leads.lead_phone` inconsistent.
- The database allows multiple active reminder rows per lead. App service cancels previous active cycles before creating a new one, but that multi-step policy is not protected by a uniqueness constraint and some lifecycle operations span non-transactional writes.
- Lead/user deletes are governed by cascades and SET NULL actions documented in the schema; application UI deletion flows were not identified in the route inventory.
- `users.cluster_head_id` and `team_lead_id` FKs do not enforce roles or cluster consistency. Controller checks are therefore essential, and direct DB writes can violate business hierarchy while satisfying the FK.

## Project field investigation

`leads.project` is defined as nullable `varchar(150)`. It stores the name directly per lead; the dump provides no project master table, FK, ENUM, default, or index. `public/project-list.json` is the independent project catalog used by the UI and backend validation. The backend derives `project_location` and `category` from JSON rather than trusting submitted dependent values. The project owner reports `project_location` and `profession` columns are present in the local DB, but they are absent from the dump. Legacy project/location/category values are preserved when the current legacy project remains unchanged. A separate project DB table would require a migration and compatibility/data-cleanup policy.

`profession` is optional free text submitted by the create/edit forms and allowlisted by lead update. Backend validates the 150-character ceiling; the HTML input also has `maxlength=150`. Lead list SELECT uses `l.*`, so both manually added columns are returned without explicit column additions. Other dashboard summary SELECTs do not fetch full lead detail and remain unchanged.

Legacy project-name values present in the dump and absent from the configured JSON list: `Rangs Commercial Hub`, `Rangs Lakeview`, `Rangs Nisorgo`, and `Torukabbo`. These are reported as names only; no lead/person sample data is included. Existing records were not changed.

## Conclusion

The schema and application are broadly aligned on the six referenced tables and direct columns. The main compatibility risks are value normalization around `leads.status`, the absence of DB-enforced primary-phone/count rules, free-text project inconsistency, role semantics not enforced by hierarchy FKs, and transaction gaps around coupled updates. These findings do not constitute authorization to change schema or application behavior.
