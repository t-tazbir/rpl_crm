# Database verification report

Reference: `rpl_crm.sql` (MariaDB 10.4.32 dump). Compared to the four database docs and backend code. This is dump verification only, not live production verification. INSERT sample records are excluded.

| Item | SQL dump | Documentation | Result |
|---|---|---|---|
| Six CREATE TABLE definitions | `users`, `leads`, `lead_contact_phones`, `lead_activities`, `followup_reminders`, `todos` | Six tables documented | Verified |
| Columns/types | Definitions include all columns/types | Schema tables enumerate them | Verified |
| Nullability/defaults | Explicit in DDL | Documented per column | Verified |
| Primary keys | `id` in every table | Documented | Verified |
| Unique constraints | users.email; leads.lead_id; lead_contact_phones.phone_number | Documented | Verified |
| Foreign keys | 11 constraints in ALTER statements | All names/columns/actions documented | Verified |
| ON DELETE | CASCADE or SET NULL as detailed | Documented | Verified |
| ON UPDATE | Omitted on every FK; MariaDB default RESTRICT | Explicitly marked default | Verified |
| Secondary indexes | All keys in ALTER statements | Documented by table | Verified |
| ENUM values | Eight ENUM columns across tables | Values enumerated | Verified |
| AUTO_INCREMENT | Counters: users 22, leads 31, phones 44, activities 72, reminders 20, todos 19 | Documented | Verified |
| Generated columns | None in dump | None reported | Verified |
| Triggers/procedures/views | None defined | None reported | Verified |
| Standalone CREATE INDEX | None; indexes created with ALTER TABLE | Schema doc says no standalone statement | Verified |
| Sample row content | INSERT records exist | Excluded from docs | Verified |
| Live schema | Not inspected | Not claimed | Not Applicable |

No schema-document mismatch found in the checked four database docs. The application is not part of the schema documentation verdict; compatibility findings are in `sql-query-compatibility-report.md` and `lead-management-deep-dive.md`.

## Verified counts

Six tables; 11 FKs; three UNIQUE constraints; 14 secondary index definitions (not counting primary/unique indexes); eight ENUM columns; no triggers, procedures, views, or generated columns. Index count derived from the table ALTER definitions.
