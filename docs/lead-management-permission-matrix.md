# Lead permission matrix

Based on `routes/leadRoutes.js`, `middleware/roleMiddleware.js`, and controller object-scope checks. “Not allowed” means route/controller provides no such operation for the role, not a policy recommendation.

| Capability | DD_ED | CLUSTER_HEAD | TEAM_LEAD | SALES_MAN | ADMIN |
|---|---|---|---|---|---|
| View leads | All assigned or unassigned pool by query | Leads whose `sales_rep_id` is a user in CH's cluster; unassigned excluded by `IN` scope | Own leads plus current reports' leads | Own leads | No special lead branch; behavior depends controller fallback (do not assume admin scope) |
| Create lead | Yes; creator becomes owner | Yes; creator becomes owner, cluster set to self | Yes; creator becomes owner | Yes; own | No explicit role denial; fallback query scope is not defined as admin policy |
| Edit lead | Yes, no role-specific object restriction in controller | Only lead.cluster_head_id equals self | Own lead or current report's lead | Own lead only | No explicit denial; controller's unhandled role branch creates broad concern |
| Assign/reassign via transfer endpoint | Yes, target must be SALES_MAN | Yes, only own cluster lead/target | No (route role gate) | No | No (route role gate) |
| Unassigned pool view | Yes with `unassigned=true` | No | No | No | No specific pool branch |
| Delete lead | No endpoint | No endpoint | No endpoint | No endpoint | No endpoint |
| View activities / manage phones | Auth + `assertLeadAccess` hierarchy | Same service check | Same service check | Same service check | Access depends on service logic; no route role block |
| Manage follow-ups | Lead create/update permitted when object scope allows; reminder service syncs | Same | Same | Same | Controller fallback concern |
| Dashboard | `/stats`, `/team-breakdown`, `/org-chart` | `/stats`, `/team-breakdown` | `/my-stats` (self-only stats) | `/my-stats` | No explicit dashboard permission |

Important caveat: `/api/leads` GET/POST/PUT endpoints use `auth` but no route role middleware. `getLeads` has explicit branches for the named roles; an unrecognized role such as `ADMIN` is not explicitly denied and may fall through to broad query scope. Review/confirm intended behavior; this document does not change it. For contact/activity access, inspect `services/leadAccessService.js`; `assertLeadAccess` is the common object-level gate.
