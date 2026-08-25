-- V38 : création idempotente du catalogue général des métiers.
-- Les colonnes de compatibilité et la reprise des données existantes sont
-- finalisées automatiquement par ensureSchema() au premier appel de la V38.
CREATE TABLE IF NOT EXISTS trade_catalog (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  name TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, phase, name)
);
CREATE INDEX IF NOT EXISTS idx_trade_catalog_company ON trade_catalog(company_id, phase, name);
