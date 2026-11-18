# Business logic and workflows

## Lead intake and lifecycle

Authenticated users create leads. Source code generates IDs in `LD-YYMMDD-NNNN` form, creates the lead plus primary lead phone in a transaction, and maps duplicate phone errors to conflict responses. Lead list queries apply role scopes and filters, including stage/status/search, hierarchy/member, follow-up, stale, and management unassigned views. Updates validate an allowed set of columns and record relevant changes as activity entries. Transfers are limited at the route to Cluster Heads and DD/ED.

## Contacts and activity

Contact endpoints manage lead and spouse phone rows and primary lead number synchronization. Code describes caps of four lead numbers and two spouse numbers and one expected primary lead number; exact DB enforcement is unverified. Access uses current ownership/hierarchy checks. Activities include user events and system events; activity logging refreshes lead `updated_at`.

## Team management

Cluster Heads can inspect their cluster, promote a cluster Sales Man to Team Lead, demote a Team Lead, and assign/unassign Sales Men. Demotion is transactional. Management can inspect cluster heads and organization-wide data. Confirm actual team lead scope and assignments against SQL and current role records before changing policy.

## Reminders and stale release

Reminder job runs every 10 minutes. Overdue active cycles are marked done; upcoming cycles within four hours are eligible, with a ten-minute minimum send cadence, and dispatch via WhatsApp. Lead update workflows cancel prior active cycles and create a new cycle for future follow-up on an Active lead. Daily at 02:00 process timezone, the unassign job releases Active leads with no future follow-up and no update for 120 days, cancels active reminders, and records a system activity. Cron runs in each process instance.

## Other workflows

Password reset stores a hash of a random token with a 30-minute expiry; successful reset clears it. To-dos are owned by the authenticated user and optionally link to a lead. Dashboard endpoints aggregate status/stage/source/project/engagement and role-specific team summaries.

## Evidence caveat

This is behavior visible in source, not a statement of deployed data validity or owner-approved policy. In particular, dashboard route permits Team Lead personal stats but controller queries only that user’s leads; this limitation is captured in known issues.
