/*
  # Add correlation_id to chat_messages

  ## Purpose
  Adds a nullable correlation_id column for tracing related messages and creates an
  index to speed up correlation lookups.
  Triggers a PostgREST schema cache reload so the new column is immediately
  available to API clients.
*/

-- Add correlation_id column if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'chat_messages'
      AND column_name = 'correlation_id'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN correlation_id text;
  END IF;
END $$;

-- Create index to support correlation lookups
CREATE INDEX IF NOT EXISTS idx_chat_messages_correlation_id
  ON chat_messages (correlation_id)
  WHERE correlation_id IS NOT NULL;

-- Refresh PostgREST schema cache so new column is usable immediately
NOTIFY pgrst, 'reload schema';
