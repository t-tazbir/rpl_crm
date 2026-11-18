# Lead creation workflow

```mermaid
sequenceDiagram
    participant UI as leads.html
    participant API as POST /api/leads
    participant C as leadController.createLead
    participant DB as MySQL
    participant R as reminder service
    participant A as activity log service
    UI->>API: fields + cookie
    API->>C: auth middleware attaches req.user
    C->>C: require name/phone; generate daily ID
    C->>DB: transaction: INSERT leads
    C->>DB: INSERT primary lead phone
    C->>DB: COMMIT
    opt next_follow_up supplied
      C->>R: cancel old active; create future active cycle if Active
    end
    C->>A: insert created event; update leads.updated_at
    C-->>UI: 201 with lead_id
```

The lead and phone insert are atomic together; reminder/activity work occurs after commit and can fail independently. Duplicate unique phone/lead ID maps through the duplicate error handler. See `controllers/leadController.js` `createLead` and `public/leads.html` create form.
