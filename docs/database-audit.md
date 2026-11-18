# Database quality audit

## Evidence

Schema facts in this audit are from `rpl_crm.sql` (MariaDB 10.4.32, InnoDB, utf8mb4_general_ci). It contains six tables, 11 foreign keys, primary and secondary indexes described in `database-schema.md`, and no trigger, procedure, view, generated column, or migration definitions. Sample INSERT content is excluded.

## Confirmed design characteristics

- `users.email`, `leads.lead_id`, and `lead_contact_phones.phone_number` are unique. Phone uniqueness is global across both lead and spouse contact types.
- Every table has an integer primary key. Five are AUTO_INCREMENT; the dump's counters are recorded per table in the schema document.
- Lead stage, status, source, meeting flags, activity type, contact type, reminder status and user role use ENUMs. Exact values are listed in `database-schema.md`.
- User hierarchy is represented by two nullable self-FKs. Lead owner/cluster/prior-owner are nullable user FKs.
- Lead-owned activity, phone, and reminder rows cascade on lead deletion. User-owned todos cascade on user deletion. Other selected references are set NULL on parent deletion.
- There are no project lookup/catalog tables. `leads.project` is nullable free text, not indexed or FK-constrained.

## Confirmed risks / concerns

1. **Historical deletion:** deleting a lead cascades to its contacts, activities, and reminders. This removes timeline history and reminder records. Deleting a user cascades to todos, while lead ownership references and activity attribution become NULL. Whether this is acceptable is a business policy question.
2. **Hierarchy semantics are not constrained:** `cluster_head_id` and `team_lead_id` reference any `users.id`; FK constraints do not ensure that referenced users have the intended role or belong to a valid hierarchy.
3. **Phone constraints do not encode application caps/primary rules:** there is a global unique phone index, but no per-lead count cap, no unique rule for at most one primary phone per lead, and no rule requiring a primary phone. Application checks can race under concurrent writes.
4. **Project naming consistency:** free text permits NULLs, arbitrary names, case/spacing variants, and spelling variants; there is no catalog or index.
5. **Index coverage is limited:** no indexes are declared for `leads.next_follow_up`, `leads.project`, `leads.stage`, `leads.category`, `leads.source`, `leads.unassigned_at`; `lead_activities.created_at`; `todos.is_done`/`due_date`; or `users.role`. Some filter/group-by queries may scan or sort more rows as data grows. Actual impact requires production-sized data and query plans.
6. **Reminder lookup composite:** the schema has `(status, follow_up_at)` index, useful for job eligibility checks; lead cancellation uses lead_id index. No uniqueness prevents multiple active reminder rows for one lead.
7. **FK updates:** all constraints omit `ON UPDATE`, leaving MariaDB's restrictive default; primary key changes would fail when referenced.
8. **No schema evolution history:** the dump has structure/data but no migration framework/versioning in the application repository.

## Recommendations (not implemented)

- Decide and document retention/deletion policy before deleting users or leads; consider soft deletion or archival if audit history must persist.
- If hierarchy correctness must be guaranteed at the database layer, define a migration-safe design; current FKs only guarantee referenced IDs exist.
- Evaluate whether phone caps and one-primary invariants need DB-enforced representation. Do not assume current app-level checks are race-proof.
- Establish canonical project handling before adding project reporting or a catalog; plan migration/compatibility for existing text values.
- Use query plans and representative workload to assess indexes rather than adding indexes solely from code inspection.
- Introduce versioned, reviewable schema migrations and test them against a non-production database.

No SQL was executed and no live database was accessed or changed.
