-- Demo aggregate: transactions serialize mutations so votes, invitations and
-- immutable report revisions cannot race. No application state lives in RAM.
CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS app_state (
    id integer PRIMARY KEY CHECK (id = 1),
    data jsonb NOT NULL,
    revision bigint NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO schema_migrations(version) VALUES (1) ON CONFLICT DO NOTHING;
