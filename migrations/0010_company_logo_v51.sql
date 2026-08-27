-- V51 : logo d’entreprise personnalisé réservé aux comptes Standard / Business actifs.
-- La colonne est ajoutée de façon idempotente par ensureSchema() au premier démarrage.
CREATE TABLE IF NOT EXISTS v51_schema_marker (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO v51_schema_marker(version) VALUES('51.0.0');
