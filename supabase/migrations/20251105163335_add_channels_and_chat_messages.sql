/*
  # WebChannel Chat System - Channels and Messages

  ## Overview
  Adds support for multi-channel chat conversations with persistent message history.
  Integrates with Supabase Auth for user authentication and maintains compatibility
  with existing web_users table for Wix integration.

  ## 1. New Tables

  ### `channels`
  Chat channels/rooms where conversations take place.
  - `id` (uuid, primary key) - Unique channel identifier
  - `name` (text, required) - Display name of the channel
  - `description` (text, optional) - Channel description
  - `created_by` (uuid, FK to auth.users.id) - Channel creator
  - `is_default` (boolean) - Whether this is the default channel
  - `created_at` (timestamptz) - Channel creation time
  - `updated_at` (timestamptz) - Last modification time

  ### `channel_members`
  Manages which users have access to which channels.
  - `id` (uuid, primary key) - Membership identifier
  - `channel_id` (uuid, FK to channels.id) - The channel
  - `user_id` (uuid, FK to auth.users.id) - The user
  - `role` (text) - User role in channel (member, admin)
  - `joined_at` (timestamptz) - When user joined channel

  ### `chat_messages`
  Persistent storage for all chat messages with webhook integration.
  - `id` (uuid, primary key) - Message identifier
  - `channel_id` (uuid, FK to channels.id) - Channel where message was sent
  - `user_id` (uuid, FK to auth.users.id, nullable) - Sender (null for bot messages)
  - `role` (text, required) - 'user' or 'assistant' (bot)
  - `content` (text, required) - Message text
  - `content_type` (text) - Type of content (text, trends, topics, summary)
  - `structured_data` (jsonb) - Additional structured data for special message types
  - `metadata` (jsonb) - Extra metadata (trend info, topic info, etc.)
  - `status` (text) - Message status (sent, delivered, error)
  - `webhook_response` (jsonb) - Raw webhook response for debugging
  - `created_at` (timestamptz) - Message timestamp

  ## 2. Integration with Existing System
  - Links to auth.users for Supabase Auth integration
  - Maintains compatibility with web_users for Wix subscription tracking
  - Preserves web_messages table for audit logging
  - New chat_messages table for persistent chat history

  ## 3. Security
  - Enable RLS on all new tables
  - Users can only access channels they are members of
  - Users can only send messages in their channels
  - Bot messages (null user_id) are visible to all channel members

  ## 4. Indexes
  - Channel lookups by name and creator
  - Member lookups by user and channel
  - Message lookups by channel and timestamp
  - Efficient pagination of message history

  ## 5. Important Notes
  - Default "General" channel will be created for all new users
  - Message history is preserved indefinitely (implement archiving later if needed)
  - Webhook responses are logged for debugging purposes
*/

-- Create channels table
CREATE TABLE IF NOT EXISTS channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_channel_name CHECK (length(trim(name)) > 0)
);

-- Create channel_members table
CREATE TABLE IF NOT EXISTS channel_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz DEFAULT now(),
  CONSTRAINT valid_member_role CHECK (role IN ('member', 'admin')),
  CONSTRAINT unique_channel_member UNIQUE (channel_id, user_id)
);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  role text NOT NULL,
  content text NOT NULL,
  content_type text DEFAULT 'text',
  structured_data jsonb,
  metadata jsonb,
  status text DEFAULT 'sent',
  webhook_response jsonb,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_role CHECK (role IN ('user', 'assistant')),
  CONSTRAINT valid_content_type CHECK (content_type IN ('text', 'trends', 'topics', 'summary')),
  CONSTRAINT valid_status CHECK (status IN ('sent', 'delivered', 'error', 'sending'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_channels_created_by ON channels(created_by);
CREATE INDEX IF NOT EXISTS idx_channels_is_default ON channels(is_default);
CREATE INDEX IF NOT EXISTS idx_channel_members_user_id ON channel_members(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_channel_id ON channel_members(channel_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_id_created_at ON chat_messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);

-- Enable Row Level Security
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for channels
CREATE POLICY "Users can view channels they are members of"
  ON channels FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_members.channel_id = channels.id
      AND channel_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create channels"
  ON channels FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Channel creators can update their channels"
  ON channels FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Channel creators can delete their channels"
  ON channels FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- RLS Policies for channel_members
CREATE POLICY "Users can view members of their channels"
  ON channel_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM channel_members cm
      WHERE cm.channel_id = channel_members.channel_id
      AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Channel admins can add members"
  ON channel_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_members.channel_id = channel_members.channel_id
      AND channel_members.user_id = auth.uid()
      AND channel_members.role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM channels
      WHERE channels.id = channel_members.channel_id
      AND channels.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can leave channels"
  ON channel_members FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for chat_messages
CREATE POLICY "Users can view messages in their channels"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_members.channel_id = chat_messages.channel_id
      AND channel_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages in their channels"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_members.channel_id = chat_messages.channel_id
      AND channel_members.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert bot messages"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    role = 'assistant'
    AND user_id IS NULL
  );

-- Triggers for updated_at on channels
CREATE TRIGGER update_channels_updated_at
  BEFORE UPDATE ON channels
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to create default channel for new users
CREATE OR REPLACE FUNCTION create_default_channel_for_user()
RETURNS TRIGGER AS $$
DECLARE
  default_channel_id uuid;
BEGIN
  -- Check if a default channel already exists
  SELECT id INTO default_channel_id
  FROM channels
  WHERE is_default = true
  LIMIT 1;

  -- If no default channel exists, create one
  IF default_channel_id IS NULL THEN
    INSERT INTO channels (name, description, created_by, is_default)
    VALUES ('General', 'Default chat channel', NEW.id, true)
    RETURNING id INTO default_channel_id;
  END IF;

  -- Add user to the default channel
  INSERT INTO channel_members (channel_id, user_id, role)
  VALUES (default_channel_id, NEW.id, 'member')
  ON CONFLICT (channel_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create default channel membership for new auth users
CREATE TRIGGER on_auth_user_created_channel
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_channel_for_user();

-- Create initial default channel if it doesn't exist
DO $$
DECLARE
  default_channel_id uuid;
BEGIN
  SELECT id INTO default_channel_id
  FROM channels
  WHERE is_default = true
  LIMIT 1;

  IF default_channel_id IS NULL THEN
    INSERT INTO channels (name, description, is_default)
    VALUES ('General', 'Default chat channel for all users', true);
  END IF;
END $$;
