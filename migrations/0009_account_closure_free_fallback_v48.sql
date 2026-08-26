-- V48 : demandes sécurisées de fermeture de compte et bascule automatique
-- des abonnements payants expirés vers Free pendant 10 jours à compter
-- de la date exacte d'expiration du plan précédent.

CREATE TABLE IF NOT EXISTS account_closure_requests (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  handled_by TEXT,
  support_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  handled_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_account_closure_company_status
ON account_closure_requests(company_id,status,created_at);

-- Conversion initiale des abonnements Standard / Business déjà expirés.
-- Important : le Free ne se renouvelle pas automatiquement après ses 10 jours.
UPDATE companies
SET
  plan = 'free',
  plan_started_at = plan_expires_at,
  plan_expires_at = strftime('%Y-%m-%dT%H:%M:%fZ', datetime(plan_expires_at, '+10 days')),
  updated_at = CURRENT_TIMESTAMP
WHERE lower(COALESCE(plan,'')) IN ('standard','business')
  AND plan_expires_at IS NOT NULL
  AND trim(plan_expires_at) <> ''
  AND datetime(plan_expires_at) <= datetime('now');
