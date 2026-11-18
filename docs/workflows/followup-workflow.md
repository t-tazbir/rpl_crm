# Follow-up workflow

```mermaid
flowchart TD
  A[Lead create/update sets next_follow_up] --> B[syncReminderForLead]
  B --> C[Cancel active reminders for lead]
  C --> D{Future date and status Active?}
  D -->|Yes| E[Insert active reminder cycle]
  D -->|No| F[No new cycle]
  E --> G[Every 10 minutes job]
  G --> H[Mark overdue active cycles done]
  G --> I[Select active future reminders in 4h window and cadence eligible]
  I --> J[Send WhatsApp template]
  J --> K[Increment send_count and set last_sent_at]
```

Lead date is stored in `leads.next_follow_up`; reminder row is dispatch state. There is no unique active-cycle constraint. Sending and post-send update are separate, so failure can cause repeat sends. `services/followupReminderService.js`, `jobs/followupReminderJob.js`, `services/whatsappService.js`.
