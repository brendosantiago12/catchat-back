-- Migration: criar tabela de OTPs para autenticação UNLIMITED
-- Execute no SQL Editor do painel do Supabase do CatChat

CREATE TABLE IF NOT EXISTS otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_phone text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otps_user_phone ON otps (user_phone);

-- Índices de performance para subscriptions (se ainda não existirem)
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_phone ON subscriptions (user_phone);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status_expires ON subscriptions (status, expires_at);
