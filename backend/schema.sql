CREATE TABLE IF NOT EXISTS deployments (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  application_name VARCHAR(100) NOT NULL CHECK (length(trim(application_name)) > 0),
  environment VARCHAR(100) NOT NULL CHECK (length(trim(environment)) > 0),
  version VARCHAR(100) NOT NULL CHECK (length(trim(version)) > 0),
  status VARCHAR(100) NOT NULL CHECK (status IN ('pending', 'in_progress', 'succeeded', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
