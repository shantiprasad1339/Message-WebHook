CREATE TABLE messages (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  tenant_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  recipient TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sent_at TEXT,
  delivered_at TEXT,
  read_at TEXT,
  failed_at TEXT
);

CREATE INDEX idx_messages_conversation ON messages (tenant_id, conversation_id, seq);

CREATE TABLE webhook_events (
  event_id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES messages (id),
  status TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('APPLIED', 'IGNORED'))
);

CREATE INDEX idx_webhook_events_message ON webhook_events (message_id);
