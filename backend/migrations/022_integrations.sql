-- =============================================
-- 022: INTEGRACIONES (REGISTRO RÁPIDO, WHATSAPP, ATAJOS)
-- =============================================
--  - api_tokens: tokens personales para automatizaciones (Atajos de iPhone,
--    HTTP Shortcuts / MacroDroid / Tasker en Android). Solo se guarda el
--    hash SHA-256; el token completo se muestra una única vez al crearlo.
--  - quick_entry_settings: cuentas por defecto cuando el mensaje no nombra una.
--  - quick_entry_log: qué registró cada canal, para poder "deshacer".
--  - whatsapp_links / whatsapp_link_codes: vincula un número de WhatsApp a un
--    usuario con un código de un solo uso que vence a los 10 minutos.
--  - whatsapp_pending: borrador esperando confirmación ("sí" / "no").
--  - whatsapp_processed_messages: idempotencia (Meta reintenta webhooks).

CREATE TABLE IF NOT EXISTS api_tokens (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(80) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  token_prefix VARCHAR(16) NOT NULL,
  last_used_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP NULL,
  CONSTRAINT uk_api_tokens_hash UNIQUE (token_hash),
  CONSTRAINT fk_api_tokens_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON api_tokens (user_id);

CREATE TABLE IF NOT EXISTS quick_entry_settings (
  user_id INT PRIMARY KEY,
  default_expense_account_id INT NULL,
  default_income_account_id INT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_qes_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_qes_expense_account FOREIGN KEY (default_expense_account_id)
    REFERENCES accounts(id) ON DELETE SET NULL,
  CONSTRAINT fk_qes_income_account FOREIGN KEY (default_income_account_id)
    REFERENCES accounts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS quick_entry_log (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  source VARCHAR(20) NOT NULL CHECK (source IN ('whatsapp', 'api', 'web')),
  kind VARCHAR(10) NOT NULL CHECK (kind IN ('expense', 'income')),
  record_id INT NOT NULL,
  original_text TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  undone_at TIMESTAMP NULL,
  CONSTRAINT fk_qel_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_quick_entry_log_user ON quick_entry_log (user_id, id DESC);

CREATE TABLE IF NOT EXISTS whatsapp_links (
  user_id INT PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uk_whatsapp_links_phone UNIQUE (phone),
  CONSTRAINT fk_whatsapp_links_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS whatsapp_link_codes (
  user_id INT PRIMARY KEY,
  code_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  CONSTRAINT uk_whatsapp_link_codes_hash UNIQUE (code_hash),
  CONSTRAINT fk_whatsapp_link_codes_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS whatsapp_pending (
  phone VARCHAR(20) PRIMARY KEY,
  user_id INT NOT NULL,
  draft JSONB NOT NULL,
  original_text TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_whatsapp_pending_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS whatsapp_processed_messages (
  message_id VARCHAR(128) PRIMARY KEY,
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
