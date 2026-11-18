# API inventory

All endpoints are mounted by `server.js`. Unless called out as public, they require the `token` cookie. Browser requests include cookies. Payload/response detail below summarizes source behavior; response shapes are not fully uniform. Controller files contain the final validation and exact response fields.

## Authentication — `/api/auth`

| Method/path | Access | Purpose / inputs |
|---|---|---|
| POST `/login` | Public | `{email,password}`; authenticate and set cookie; returns user display data |
| POST `/logout` | Public | Clear auth cookie |
| POST `/reset-password` | Authenticated | `{oldPassword,newPassword}`; change password |
| POST `/forgot-password` | Public | `{email}`; generic reset request response |
| GET `/forgot-password/verify?token=` | Public | Validate reset token |
| POST `/forgot-password/confirm` | Public | `{token,newPassword}`; complete reset |

## Leads — `/api/leads`

| Method/path | Access | Purpose / inputs |
|---|---|---|
| GET `/` | Authenticated | Role-scoped lead list; query filters are defined in `leadController.getLeads` |
| POST `/` | Authenticated | Create lead; lead fields and primary phone |
| PUT `/:id` | Authenticated + object scope | Update allowlisted lead fields |
| PUT `/:leadId/transfer` | DD_ED, CLUSTER_HEAD + controller scope | Transfer to Sales Man; target owner in body |
| GET `/:id/phones` | Authenticated + lead access | List lead/spouse phones |
| POST `/:id/phones` | Authenticated + lead access | Add lead phone `{phone_number,is_primary?}` |
| PUT `/:id/phones/:phoneId/primary` | Authenticated + lead access | Set primary lead phone |
| DELETE `/:id/phones/:phoneId` | Authenticated + lead access | Delete lead phone |
| PUT `/:id/spouse` | Authenticated + lead access | `{spouse_name}` |
| POST `/:id/spouse-phones` | Authenticated + lead access | `{phone_number}` |
| DELETE `/:id/spouse-phones/:phoneId` | Authenticated + lead access | Delete spouse phone |
| GET `/:id/activities` | Authenticated + lead access | Read timeline |
| POST `/:id/activities` | Authenticated + lead access | `{activity_type,description}` |

## Dashboard — `/api/dashboard`

| Method/path | Access | Purpose / inputs |
|---|---|---|
| GET `/stats` | DD_ED, CLUSTER_HEAD | Aggregate dashboards; DD/ED may pass `cluster_head_id` |
| GET `/my-stats` | SALES_MAN, TEAM_LEAD | Own KPIs, today follow-ups, stale and converted leads |
| GET `/team-breakdown` | DD_ED, CLUSTER_HEAD | Per-rep team data; DD/ED requires `cluster_head_id` |
| GET `/org-chart` | DD_ED | Organization hierarchy and lead aggregates |

## Users — `/api/users`

| Method/path | Access | Purpose / inputs |
|---|---|---|
| GET `/team` | Authenticated | Role-aware team listing; optional filters per controller |
| GET `/cluster-heads` | DD_ED | List cluster heads |
| GET `/my-cluster-members` | CLUSTER_HEAD | Own cluster members |
| POST `/:id/make-team-lead` | CLUSTER_HEAD + cluster scope | Promote user |
| POST `/:id/remove-team-lead` | CLUSTER_HEAD + cluster scope | Demote user |
| PUT `/:id/assign-team-lead` | CLUSTER_HEAD + cluster scope | `{team_lead_id:number|null}` |
| GET `/me` | Authenticated | Own profile |
| PUT `/me` | Authenticated | Update own profile fields |
| PUT `/me/email` | Authenticated | Email change with password confirmation |
| POST `/me/profile-picture` | Authenticated | Multipart `profile_picture`; image upload |

## To-dos — `/api/todos`

| Method/path | Access | Purpose / inputs |
|---|---|---|
| GET `/` | Authenticated | List caller’s tasks |
| POST `/` | Authenticated | `{title,due_date?,lead_id?}` |
| PUT `/:id` | Authenticated + owner check | `{title?,due_date?,is_done?}` |
| DELETE `/:id` | Authenticated + owner check | Delete own task |

Successful list/read responses commonly use `{success,data}`; mutation and error bodies often use `{message}`. Dashboard and other endpoints have custom response shapes. There is no OpenAPI contract in the repository.
