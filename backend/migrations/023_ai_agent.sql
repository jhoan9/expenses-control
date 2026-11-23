-- =============================================
-- 023: ASISTENTE CON HERRAMIENTAS (AGENTE)
-- =============================================
--  - ai_messages.meta: herramientas usadas y acciones propuestas en la respuesta.
--  - ai_pending_actions: toda acción que modifica datos (registrar un gasto,
--    renombrar una categoría, crear un presupuesto, crear un conector) queda
--    pendiente hasta que el usuario la confirma desde el chat.
--  - ai_connectors: APIs externas que el usuario autoriza para el asistente.
--    Solo GET, solo HTTPS y solo al host registrado. El secreto (API key) se
--    guarda cifrado con AES-256-GCM usando una clave del servidor.
--  - quick_entry_log admite 'assistant' como origen.

ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS meta JSONB NULL;

CREATE TABLE IF NOT EXISTS ai_pending_actions (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  conversation_id INT NOT NULL,
  message_id INT NULL,
  tool VARCHAR(60) NOT NULL,
  args JSONB NOT NULL,
  summary TEXT NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'failed', 'expired')),
  result TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  CONSTRAINT fk_ai_actions_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_ai_actions_conversation FOREIGN KEY (conversation_id)
    REFERENCES ai_conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_actions_conversation ON ai_pending_actions (conversation_id, id);

CREATE TABLE IF NOT EXISTS ai_connectors (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(60) NOT NULL,
  description TEXT NULL,
  base_url VARCHAR(300) NOT NULL,
  auth_type VARCHAR(10) NOT NULL DEFAULT 'none' CHECK (auth_type IN ('none', 'header', 'query')),
  auth_name VARCHAR(60) NULL,
  secret_encrypted TEXT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_used_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uk_ai_connectors_name UNIQUE (user_id, name),
  CONSTRAINT fk_ai_connectors_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
);

ALTER TABLE quick_entry_log DROP CONSTRAINT IF EXISTS quick_entry_log_source_check;
ALTER TABLE quick_entry_log
  ADD CONSTRAINT quick_entry_log_source_check
  CHECK (source IN ('whatsapp', 'api', 'web', 'assistant'));
