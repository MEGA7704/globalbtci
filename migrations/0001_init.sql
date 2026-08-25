PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled','deleted')),
  plan TEXT NOT NULL DEFAULT 'free' CHECK(plan IN ('free','business')),
  plan_started_at TEXT NOT NULL,
  plan_expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  company_id TEXT,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK(role IN ('superadmin','admin','agent')),
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL DEFAULT 210000,
  password_version INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled','deleted')),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(company_id) REFERENCES companies(id)
);

CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  project_type TEXT,
  location TEXT,
  owner_name TEXT,
  manager_name TEXT,
  budget INTEGER NOT NULL DEFAULT 0 CHECK(budget >= 0),
  start_date TEXT,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('preparation','in_progress','suspended','completed')),
  description TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(company_id) REFERENCES companies(id)
);

CREATE INDEX IF NOT EXISTS idx_projects_company ON projects(company_id);
CREATE INDEX IF NOT EXISTS idx_projects_company_status ON projects(company_id,status);

CREATE TABLE IF NOT EXISTS trades (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id,project_id,name),
  FOREIGN KEY(company_id) REFERENCES companies(id),
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE INDEX IF NOT EXISTS idx_trades_company_project ON trades(company_id,project_id);

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  specialty TEXT,
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(company_id) REFERENCES companies(id)
);

CREATE INDEX IF NOT EXISTS idx_suppliers_company ON suppliers(company_id);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  trade_id TEXT,
  supplier_id TEXT,
  expense_date TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 0 CHECK(quantity >= 0),
  unit TEXT,
  unit_price INTEGER NOT NULL DEFAULT 0 CHECK(unit_price >= 0),
  total_price INTEGER NOT NULL DEFAULT 0 CHECK(total_price >= 0),
  invoice_reference TEXT,
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(company_id) REFERENCES companies(id),
  FOREIGN KEY(project_id) REFERENCES projects(id),
  FOREIGN KEY(trade_id) REFERENCES trades(id),
  FOREIGN KEY(supplier_id) REFERENCES suppliers(id)
);

CREATE INDEX IF NOT EXISTS idx_expenses_company_date ON expenses(company_id,expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_project ON expenses(company_id,project_id);
CREATE INDEX IF NOT EXISTS idx_expenses_trade ON expenses(company_id,trade_id);

CREATE TABLE IF NOT EXISTS labor_expenses (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  trade_id TEXT,
  expense_date TEXT NOT NULL,
  worker_name TEXT,
  work_description TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0 CHECK(amount >= 0),
  payment_method TEXT,
  payment_reference TEXT,
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(company_id) REFERENCES companies(id),
  FOREIGN KEY(project_id) REFERENCES projects(id),
  FOREIGN KEY(trade_id) REFERENCES trades(id)
);

CREATE INDEX IF NOT EXISTS idx_labor_company_date ON labor_expenses(company_id,expense_date);
CREATE INDEX IF NOT EXISTS idx_labor_project ON labor_expenses(company_id,project_id);

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id TEXT PRIMARY KEY,
  company_id TEXT,
  user_id TEXT,
  email TEXT NOT NULL,
  requested_by_ip TEXT,
  target_role TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','resolved','rejected')),
  handled_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  handled_at TEXT,
  FOREIGN KEY(company_id) REFERENCES companies(id),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_reset_status ON password_reset_requests(status,created_at);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  company_id TEXT,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  ip TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_company_created ON audit_logs(company_id,created_at);
CREATE INDEX IF NOT EXISTS idx_audit_actor_created ON audit_logs(actor_user_id,created_at);

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
