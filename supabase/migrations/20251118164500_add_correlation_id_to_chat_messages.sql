/*
  # Ensure correlation_id column on chat_messages

  Adds the correlation_id column so messages stored from the WebSocket
  pipeline can be linked back to their n8n requests.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'chat_messages'
      AND column_name = 'correlation_id'
  ) THEN
    ALTER TABLE chat_messages
    ADD COLUMN correlation_id text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_chat_messages_correlation_id
  ON chat_messages(correlation_id)
  WHERE correlation_id IS NOT NULL;
