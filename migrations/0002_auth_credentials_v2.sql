CREATE TABLE IF NOT EXISTS auth_credentials_v2 (
  user_id TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL DEFAULT 210000,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
