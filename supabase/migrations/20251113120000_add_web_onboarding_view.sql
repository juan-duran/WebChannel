-- Web onboarding read/write support for web channel

-- Store onboarding preferences tied to web users
CREATE TABLE IF NOT EXISTS web_user_onboarding (
  user_id uuid PRIMARY KEY REFERENCES web_users(id) ON DELETE CASCADE,
  handle text,
  preferred_send_time text,
  onboarding_complete boolean DEFAULT false,
  employment_status text,
  education_level text,
  family_status text,
  living_with text,
  income_bracket text,
  religion text,
  moral_values text[] DEFAULT ARRAY[]::text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE web_user_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their onboarding profile"
  ON web_user_onboarding FOR SELECT
  TO authenticated
  USING (user_id = (current_setting('app.current_user_id', true))::uuid);

CREATE POLICY "Users can insert their onboarding profile"
  ON web_user_onboarding FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (current_setting('app.current_user_id', true))::uuid);

CREATE POLICY "Users can update their onboarding profile"
  ON web_user_onboarding FOR UPDATE
  TO authenticated
  USING (user_id = (current_setting('app.current_user_id', true))::uuid)
  WITH CHECK (user_id = (current_setting('app.current_user_id', true))::uuid);

CREATE TRIGGER update_web_user_onboarding_updated_at
  BEFORE UPDATE ON web_user_onboarding
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Read view for onboarding data
CREATE OR REPLACE VIEW v_web_onboarding AS
SELECT
  wu.email AS user_email,
  COALESCE(wo.handle, wu.full_name, wu.email) AS handle,
  wo.preferred_send_time,
  COALESCE(wo.onboarding_complete, false) AS onboarding_complete,
  wo.employment_status,
  wo.education_level,
  wo.family_status,
  wo.living_with,
  wo.income_bracket,
  wo.religion,
  wo.moral_values
FROM web_users wu
LEFT JOIN web_user_onboarding wo ON wo.user_id = wu.id;

GRANT SELECT ON v_web_onboarding TO authenticated;

-- RPC to read onboarding data by email
CREATE OR REPLACE FUNCTION rpc_get_web_onboarding(p_email text)
RETURNS TABLE (
  user_email text,
  handle text,
  preferred_send_time text,
  onboarding_complete boolean,
  employment_status text,
  education_level text,
  family_status text,
  living_with text,
  income_bracket text,
  religion text,
  moral_values text[]
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF auth.jwt() IS NOT NULL AND lower(auth.jwt() ->> 'email') <> lower(p_email) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    v.user_email,
    v.handle,
    v.preferred_send_time,
    v.onboarding_complete,
    v.employment_status,
    v.education_level,
    v.family_status,
    v.living_with,
    v.income_bracket,
    v.religion,
    COALESCE(v.moral_values, ARRAY[]::text[])
  FROM v_web_onboarding v
  WHERE lower(v.user_email) = lower(p_email);
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_get_web_onboarding(text) TO authenticated;

-- RPC to upsert onboarding data
CREATE OR REPLACE FUNCTION rpc_update_web_onboarding(p_email text, p_payload jsonb)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_user_id uuid;
  v_moral_values text[];
BEGIN
  IF auth.jwt() IS NOT NULL AND lower(auth.jwt() ->> 'email') <> lower(p_email) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT id INTO v_user_id FROM web_users WHERE lower(email) = lower(p_email);

  IF v_user_id IS NULL THEN
    INSERT INTO web_users (email)
    VALUES (p_email)
    ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
    RETURNING id INTO v_user_id;
  END IF;

  SELECT COALESCE(array_agg(value::text), ARRAY[]::text[])
    INTO v_moral_values
  FROM jsonb_array_elements_text(COALESCE(p_payload -> 'moral_values', '[]'::jsonb)) AS value;

  INSERT INTO web_user_onboarding (
    user_id,
    handle,
    preferred_send_time,
    onboarding_complete,
    employment_status,
    education_level,
    family_status,
    living_with,
    income_bracket,
    religion,
    moral_values
  )
  VALUES (
    v_user_id,
    NULLIF(trim(p_payload ->> 'handle'), ''),
    NULLIF(p_payload ->> 'preferred_send_time', ''),
    COALESCE((p_payload ->> 'onboarding_complete')::boolean, true),
    NULLIF(p_payload ->> 'employment_status', ''),
    NULLIF(p_payload ->> 'education_level', ''),
    NULLIF(p_payload ->> 'family_status', ''),
    NULLIF(p_payload ->> 'living_with', ''),
    NULLIF(p_payload ->> 'income_bracket', ''),
    NULLIF(p_payload ->> 'religion', ''),
    v_moral_values
  )
  ON CONFLICT (user_id) DO UPDATE SET
    handle = EXCLUDED.handle,
    preferred_send_time = EXCLUDED.preferred_send_time,
    onboarding_complete = EXCLUDED.onboarding_complete,
    employment_status = EXCLUDED.employment_status,
    education_level = EXCLUDED.education_level,
    family_status = EXCLUDED.family_status,
    living_with = EXCLUDED.living_with,
    income_bracket = EXCLUDED.income_bracket,
    religion = EXCLUDED.religion,
    moral_values = EXCLUDED.moral_values,
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_update_web_onboarding(text, jsonb) TO authenticated;
