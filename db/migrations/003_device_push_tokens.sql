CREATE TABLE device_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('web', 'ios', 'android')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);

CREATE TRIGGER device_push_tokens_updated_at
BEFORE UPDATE ON device_push_tokens
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_device_push_tokens_business_id ON device_push_tokens(business_id);
CREATE INDEX idx_device_push_tokens_user_id ON device_push_tokens(user_id);
CREATE INDEX idx_device_push_tokens_platform ON device_push_tokens(business_id, platform);

ALTER TABLE device_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY device_push_tokens_business_context ON device_push_tokens
FOR ALL
USING (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid)
WITH CHECK (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid);
