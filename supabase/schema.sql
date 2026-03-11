-- ============================================================
-- Galton AI — Schema dedicado: galton
-- Projeto Supabase: pzwefecmqkktcybeuohm
-- Como executar: Supabase Studio → SQL Editor → colar e rodar
-- ============================================================

CREATE SCHEMA IF NOT EXISTS galton;

-- Representantes
CREATE TABLE IF NOT EXISTS galton.representatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  territory_code text,
  email text UNIQUE,
  manager_district text,
  manager_regional text
);

-- Médicos / clientes
CREATE TABLE IF NOT EXISTS galton.doctors (
  id text PRIMARY KEY,              -- account_vod__c do painel
  name text,
  cpf text,
  cnpj text,
  crm text,
  type text,
  pf_pj text,
  one_id text,                      -- ONE ID (grupo econômico)
  one_name text,
  rep_id uuid REFERENCES galton.representatives(id),
  territory_code text,
  seg_dysport text,
  seg_restylane text,
  seg_sculptra text
);

-- Vendas (1 linha por produto/pedido — NRO_PEDIDO não é único)
CREATE TABLE IF NOT EXISTS galton.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text,                    -- NRO_PEDIDO (pode repetir: 1 pedido = N produtos)
  order_status text,
  month_ref integer,
  year_ref integer,
  created_at date,
  billed_at date,
  territory_code text,
  distributor text,
  doctor_id text,                   -- ACCOUNT_ID_FATURADO_POR
  one_id text,                      -- ONEID_ID
  one_name text,
  brand text,                       -- normalizada: DYSPORT | RESTYLANE | SCULPTRA
  product_code text,
  product_name text,
  qty integer,
  qty_equiv numeric,
  value numeric,
  segmentation text,
  is_bonus boolean,
  quarter text                      -- ex: Q4_2024
);

-- Cotas
CREATE TABLE IF NOT EXISTS galton.quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id uuid REFERENCES galton.representatives(id),
  territory_code text,
  product_family text,
  mth1 numeric,
  mth2 numeric,
  mth3 numeric,
  ref_quarter text
);

-- Status ativo/positivado
CREATE TABLE IF NOT EXISTS galton.active_positivated (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id text,
  one_id text,
  one_name text,
  doctor_name text,
  period text,
  product_family text,
  is_active integer,
  is_positivated integer,
  is_active_label text,
  is_positivated_label text,
  qty_equiv numeric
);

-- ============================================================
-- Chat — histórico de conversas por representante
-- ============================================================

-- Conversas (1 por sessão de chat)
CREATE TABLE IF NOT EXISTS galton.chat_conversations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_name    text        NOT NULL,                        -- nome do representante (chave de acesso)
  title       text        NOT NULL DEFAULT 'Nova conversa',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Mensagens de cada conversa
CREATE TABLE IF NOT EXISTS galton.chat_messages (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid        NOT NULL REFERENCES galton.chat_conversations(id) ON DELETE CASCADE,
  role             text        NOT NULL CHECK (role IN ('user', 'assistant')),
  content          text        NOT NULL,
  structured_data  jsonb,                                  -- dados estruturados (near_active, etc.)
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Trigger para manter updated_at sincronizado na conversa
CREATE OR REPLACE FUNCTION galton.touch_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE galton.chat_conversations
  SET updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_conversation ON galton.chat_messages;
CREATE TRIGGER trg_touch_conversation
  AFTER INSERT ON galton.chat_messages
  FOR EACH ROW EXECUTE FUNCTION galton.touch_conversation_updated_at();

-- Índices
CREATE INDEX IF NOT EXISTS idx_chat_conv_rep     ON galton.chat_conversations(rep_name, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_msg_conv     ON galton.chat_messages(conversation_id, created_at ASC);

-- Índices úteis para queries do agente
CREATE INDEX IF NOT EXISTS idx_sales_doctor_id ON galton.sales(doctor_id);
CREATE INDEX IF NOT EXISTS idx_sales_quarter ON galton.sales(quarter);
CREATE INDEX IF NOT EXISTS idx_sales_brand ON galton.sales(brand);
CREATE INDEX IF NOT EXISTS idx_sales_billed_at ON galton.sales(billed_at);
CREATE INDEX IF NOT EXISTS idx_sales_one_id ON galton.sales(one_id);
CREATE INDEX IF NOT EXISTS idx_active_pos_doctor ON galton.active_positivated(doctor_id);
CREATE INDEX IF NOT EXISTS idx_active_pos_product ON galton.active_positivated(product_family);
