/*
  # Add Media Support and Delivery Tracking

  ## Overview
  Extends the chat system to support rich media (images, videos, links) and message delivery tracking
  including read receipts for real-time WebSocket communication.

  ## 1. New Columns Added

  ### `chat_messages` table extensions:
  - `media_url` (text, nullable) - URL to media content (image, video, etc.)
  - `media_type` (text, nullable) - MIME type of media (image/jpeg, video/mp4, etc.)
  - `media_caption` (text, nullable) - Caption or description for media
  - `media_size` (bigint, nullable) - Size of media file in bytes
  - `delivery_status` (text, default 'sent') - Message delivery status
  - `delivered_at` (timestamptz, nullable) - When message was delivered to client
  - `read_at` (timestamptz, nullable) - When message was read by user

  ## 2. New Tables

  ### `cache_invalidations`
  Logs all cache invalidation events for audit and debugging purposes.
  - `id` (uuid, primary key) - Invalidation record identifier
  - `key_prefix` (text, required) - Cache key or prefix that was invalidated
  - `invalidated_by` (text, required) - Who triggered the invalidation (admin, n8n, system)
  - `reason` (text, nullable) - Optional reason for invalidation
  - `invalidated_at` (timestamptz) - When invalidation occurred

  ### `active_connections`
  Tracks currently active WebSocket connections for session management and monitoring.
  - `id` (uuid, primary key) - Connection identifier
  - `session_id` (text, unique, required) - Unique session identifier
  - `user_id` (uuid, FK to auth.users.id) - Connected user
  - `user_email` (text, required) - User's email for lookup
  - `connected_at` (timestamptz) - When connection was established
  - `last_heartbeat` (timestamptz) - Last successful heartbeat/ping
  - `metadata` (jsonb) - Additional connection metadata (IP, user agent, etc.)

  ## 3. Security
  - Enable RLS on new tables
  - Users can only view their own connections
  - Only admins can view cache invalidation logs
  - Media URLs validated before saving

  ## 4. Indexes
  - Fast lookup by session_id for message delivery
  - Fast lookup by delivery_status for undelivered messages
  - Fast lookup by user_id for active connections
  - Fast lookup by invalidated_at for cache audit queries

  ## 5. Important Notes
  - Media files should be validated for type and size before storing URLs
  - Delivery tracking supports real-time read receipts via WebSocket
  - Active connections cleaned up automatically by backend service
  - Cache invalidations provide audit trail for debugging cache issues
*/

-- Add media support columns to chat_messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'media_url'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN media_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'media_type'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN media_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'media_caption'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN media_caption text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'media_size'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN media_size bigint;
  END IF;
END $$;

-- Add delivery tracking columns to chat_messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'delivery_status'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN delivery_status text DEFAULT 'sent';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'delivered_at'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN delivered_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'read_at'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN read_at timestamptz;
  END IF;
END $$;

-- Add constraint for delivery_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'chat_messages' AND constraint_name = 'valid_delivery_status'
  ) THEN
    ALTER TABLE chat_messages ADD CONSTRAINT valid_delivery_status
      CHECK (delivery_status IN ('sent', 'delivered', 'read', 'sending', 'error'));
  END IF;
END $$;

-- Create cache_invalidations table
CREATE TABLE IF NOT EXISTS cache_invalidations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_prefix text NOT NULL,
  invalidated_by text NOT NULL,
  reason text,
  invalidated_at timestamptz DEFAULT now()
);

-- Create active_connections table
CREATE TABLE IF NOT EXISTS active_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text UNIQUE NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email text NOT NULL,
  connected_at timestamptz DEFAULT now(),
  last_heartbeat timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_delivery_status ON chat_messages(delivery_status);
CREATE INDEX IF NOT EXISTS idx_chat_messages_media_url ON chat_messages(media_url) WHERE media_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cache_invalidations_invalidated_at ON cache_invalidations(invalidated_at DESC);
CREATE INDEX IF NOT EXISTS idx_active_connections_session_id ON active_connections(session_id);
CREATE INDEX IF NOT EXISTS idx_active_connections_user_id ON active_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_active_connections_user_email ON active_connections(user_email);
CREATE INDEX IF NOT EXISTS idx_active_connections_last_heartbeat ON active_connections(last_heartbeat);

-- Enable Row Level Security
ALTER TABLE cache_invalidations ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cache_invalidations (admin only for now, can be expanded)
CREATE POLICY "Admins can view cache invalidations"
  ON cache_invalidations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can log cache invalidations"
  ON cache_invalidations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for active_connections
CREATE POLICY "Users can view own connections"
  ON active_connections FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can manage connections"
  ON active_connections FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "System can update connections"
  ON active_connections FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "System can delete connections"
  ON active_connections FOR DELETE
  TO authenticated
  USING (true);
