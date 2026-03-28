-- Migration: user_subscriptions table for Stripe billing
-- Run via Supabase SQL editor or supabase db push

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  plan TEXT,
  status TEXT,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  deals_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_subscriptions_user_id_idx ON user_subscriptions(user_id);

ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own subscription"
  ON user_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);
