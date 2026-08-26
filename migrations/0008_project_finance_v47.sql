-- V47 : sections financières par projet.
-- Ajoute les informations de prestataire sur les ouvrages et les paiements
-- synchronisés fournisseurs / ouvrages. ensureSchema() reste idempotent et
-- protège les bases D1 déjà existantes.

CREATE TABLE IF NOT EXISTS project_payments (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_label TEXT,
  payment_date TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  payment_method TEXT,
  reference TEXT,
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_payments_company_project
  ON project_payments(company_id, project_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_project_payments_target
  ON project_payments(company_id, project_id, target_type, target_id);
