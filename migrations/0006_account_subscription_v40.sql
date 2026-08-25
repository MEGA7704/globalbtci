-- V40 : compte entreprise modifiable et demandes d'activation d'abonnement.
CREATE TABLE IF NOT EXISTS subscription_activation_requests (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  requested_plan TEXT NOT NULL,
  payment_phone TEXT NOT NULL,
  transaction_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  handled_by TEXT,
  support_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  handled_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_subscription_activation_company_status
ON subscription_activation_requests(company_id, status, created_at);
