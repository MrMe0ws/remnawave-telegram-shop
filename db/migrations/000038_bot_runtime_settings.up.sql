CREATE TABLE bot_runtime_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by BIGINT
);

CREATE INDEX idx_bot_runtime_settings_updated_at ON bot_runtime_settings (updated_at DESC);
