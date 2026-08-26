-- V41 : numérotation des projets et identité légale de l'entreprise.
-- Les colonnes V41 sont ajoutées de façon idempotente par ensureSchema() au premier
-- démarrage, ce qui protège aussi les bases déjà ouvertes avant l'application
-- manuelle des migrations. Ce marqueur permet à Wrangler de tracer la version.
CREATE TABLE IF NOT EXISTS v41_schema_marker (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO v41_schema_marker(version) VALUES('41.0.0');
