/*
  # Web App Database Schema - Core Tables

  ## Overview
  Creates the complete database schema for the web application channel, separate from WhatsApp.
  These tables handle identity, sessions, audit logs, push notifications, and conversation state.

  ## 1. New Tables

  ### `web_users`
  Canonical identity for web channel users. Email-based authentication with Wix subscription integration.
  - `id` (uuid, primary key) - Unique identifier for the user
  - `email` (text, unique, required) - Login credential, matches Wix checkout email
  - `full_name` (text, optional) - Display name
  - `subscription_status` (text, default 'inactive') - One of: active, trial, inactive, canceled
  - `wix_customer_id` (text, optional) - Wix customer reference for sync
  - `created_at` (timestamptz) - Record creation time
  - `updated_at` (timestamptz) - Last modification time

  ### `web_sessions`
  Active browser sessions with JWT tokens for authentication.
  - `id` (uuid, primary key) - Session identifier
  - `user_id` (uuid, FK to web_users.id) - Owner of the session
  - `access_token` (text, required) - JWT or opaque token
  - `expires_at` (timestamptz, required) - Session expiration
  - `user_agent` (text, optional) - Browser/device info
  - `ip` (text, optional) - Client IP for security
  - `created_at` (timestamptz) - Session creation time

  ### `web_messages`
  Audit log of all user interactions (requests and responses).
  - `id` (uuid, primary key) - Message identifier
  - `user_id` (uuid, FK to web_users.id) - User who sent/received message
  - `direction` (text, required) - 'in' (request) or 'out' (response)
  - `payload` (jsonb, required) - Request/response data
  - `created_at` (timestamptz) - Message timestamp

  ### `web_push_tokens`
  Web push notification tokens for re-engagement.
  - `id` (uuid, primary key) - Token identifier
  - `user_id` (uuid, FK to web_users.id) - Token owner
  - `token` (text, unique, required) - Push subscription token
  - `last_seen_at` (timestamptz) - Last token validation
  - `created_at` (timestamptz) - Token creation time

  ### `web_conversation_state`
  Persists user's position in the 3-level navigation flow.
  - `user_id` (uuid, primary key, FK to web_users.id) - State owner
  - `last_step` (text) - One of: assuntos, topicos, resumo
  - `state` (jsonb) - Context data (trend_id, topic_id, etc.)
  - `updated_at` (timestamptz) - Last state update

  ## 2. Security
  - Enable RLS on all tables
  - Users can only access their own data
  - Session tokens required for all operations
  - Audit trail for all interactions

  ## 3. Indexes
  - Email lookups (web_users.email)
  - Session token lookups (web_sessions.access_token)
  - User message history (web_messages.user_id, created_at)
  - Push token lookups (web_push_tokens.token)
*/

-- Create web_users table
CREATE TABLE IF NOT EXISTS web_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  full_name text,
  subscription_status text NOT NULL DEFAULT 'inactive',
  wix_customer_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT valid_status CHECK (subscription_status IN ('active', 'trial', 'inactive', 'canceled'))
);

-- Create web_sessions table
CREATE TABLE IF NOT EXISTS web_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES web_users(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  user_agent text,
  ip text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

-- Create web_messages table
CREATE TABLE IF NOT EXISTS web_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES web_users(id) ON DELETE CASCADE,
  direction text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_direction CHECK (direction IN ('in', 'out'))
);

-- Create web_push_tokens table
CREATE TABLE IF NOT EXISTS web_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES web_users(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  last_seen_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create web_conversation_state table
CREATE TABLE IF NOT EXISTS web_conversation_state (
  user_id uuid PRIMARY KEY REFERENCES web_users(id) ON DELETE CASCADE,
  last_step text,
  state jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_step CHECK (last_step IN ('assuntos', 'topicos', 'resumo'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_web_users_email ON web_users(email);
CREATE INDEX IF NOT EXISTS idx_web_users_subscription_status ON web_users(subscription_status);
CREATE INDEX IF NOT EXISTS idx_web_sessions_user_id ON web_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_web_sessions_access_token ON web_sessions(access_token);
CREATE INDEX IF NOT EXISTS idx_web_sessions_expires_at ON web_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_web_messages_user_id_created_at ON web_messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_web_push_tokens_user_id ON web_push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_web_push_tokens_token ON web_push_tokens(token);

-- Enable Row Level Security
ALTER TABLE web_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_conversation_state ENABLE ROW LEVEL SECURITY;

-- RLS Policies for web_users
CREATE POLICY "Users can view own profile"
  ON web_users FOR SELECT
  TO authenticated
  USING (id = (current_setting('app.current_user_id', true))::uuid);

CREATE POLICY "Users can update own profile"
  ON web_users FOR UPDATE
  TO authenticated
  USING (id = (current_setting('app.current_user_id', true))::uuid)
  WITH CHECK (id = (current_setting('app.current_user_id', true))::uuid);

-- RLS Policies for web_sessions
CREATE POLICY "Users can view own sessions"
  ON web_sessions FOR SELECT
  TO authenticated
  USING (user_id = (current_setting('app.current_user_id', true))::uuid);

CREATE POLICY "Users can create own sessions"
  ON web_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (current_setting('app.current_user_id', true))::uuid);

CREATE POLICY "Users can delete own sessions"
  ON web_sessions FOR DELETE
  TO authenticated
  USING (user_id = (current_setting('app.current_user_id', true))::uuid);

-- RLS Policies for web_messages
CREATE POLICY "Users can view own messages"
  ON web_messages FOR SELECT
  TO authenticated
  USING (user_id = (current_setting('app.current_user_id', true))::uuid);

CREATE POLICY "Users can create own messages"
  ON web_messages FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (current_setting('app.current_user_id', true))::uuid);

-- RLS Policies for web_push_tokens
CREATE POLICY "Users can view own push tokens"
  ON web_push_tokens FOR SELECT
  TO authenticated
  USING (user_id = (current_setting('app.current_user_id', true))::uuid);

CREATE POLICY "Users can manage own push tokens"
  ON web_push_tokens FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (current_setting('app.current_user_id', true))::uuid);

CREATE POLICY "Users can delete own push tokens"
  ON web_push_tokens FOR DELETE
  TO authenticated
  USING (user_id = (current_setting('app.current_user_id', true))::uuid);

-- RLS Policies for web_conversation_state
CREATE POLICY "Users can view own conversation state"
  ON web_conversation_state FOR SELECT
  TO authenticated
  USING (user_id = (current_setting('app.current_user_id', true))::uuid);

CREATE POLICY "Users can manage own conversation state"
  ON web_conversation_state FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (current_setting('app.current_user_id', true))::uuid);

CREATE POLICY "Users can update own conversation state"
  ON web_conversation_state FOR UPDATE
  TO authenticated
  USING (user_id = (current_setting('app.current_user_id', true))::uuid)
  WITH CHECK (user_id = (current_setting('app.current_user_id', true))::uuid);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_web_users_updated_at
  BEFORE UPDATE ON web_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_web_conversation_state_updated_at
  BEFORE UPDATE ON web_conversation_state
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
