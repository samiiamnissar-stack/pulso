-- Esquema de Pulso. Se aplica con `npm run migrate` y es idempotente.

-- gen_random_uuid() viene incluido en PostgreSQL 13 o superior

CREATE TABLE IF NOT EXISTS users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT NOT NULL UNIQUE,
  password_hash    TEXT NOT NULL,
  alias            TEXT NOT NULL,
  birthdate        DATE NOT NULL,
  gender           TEXT NOT NULL CHECK (gender IN ('mujer','hombre','no_binario','otro')),
  orientation      TEXT NOT NULL CHECK (orientation IN ('hetero','gay','lesbiana','bisexual','otra','prefiero_no_decir')),
  bio              TEXT NOT NULL DEFAULT '',
  visible_in_venue BOOLEAN NOT NULL DEFAULT FALSE,  -- opt-in: por defecto nadie es visible
  show_orientation BOOLEAN NOT NULL DEFAULT FALSE,  -- aunque sea visible, la orientación se oculta salvo que lo active
  consent_at       TIMESTAMPTZ NOT NULL,            -- consentimiento explícito (art. 9.2.a RGPD)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS venues (
  id         SERIAL PRIMARY KEY,
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  barrio     TEXT NOT NULL,
  address    TEXT NOT NULL,
  lat        DOUBLE PRECISION NOT NULL,
  lng        DOUBLE PRECISION NOT NULL,
  capacity   INTEGER NOT NULL,
  music      TEXT NOT NULL,
  opens      TEXT NOT NULL DEFAULT '00:00',
  closes     TEXT NOT NULL DEFAULT '06:00'
);

-- Solo se guarda en qué local está alguien, nunca sus coordenadas.
CREATE TABLE IF NOT EXISTS checkins (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  venue_id   INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  ended_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS checkins_active_idx ON checkins (venue_id, expires_at) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS checkins_user_idx ON checkins (user_id) WHERE ended_at IS NULL;

CREATE TABLE IF NOT EXISTS likes (
  from_user  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (from_user, to_user),
  CHECK (from_user <> to_user)
);

CREATE TABLE IF NOT EXISTS matches (
  id         BIGSERIAL PRIMARY KEY,
  user_a     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  venue_id   INTEGER REFERENCES venues(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_a < user_b),
  UNIQUE (user_a, user_b)
);

CREATE TABLE IF NOT EXISTS messages (
  id         BIGSERIAL PRIMARY KEY,
  match_id   BIGINT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sender_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_match_idx ON messages (match_id, created_at);

CREATE TABLE IF NOT EXISTS blocks (
  blocker    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker, blocked)
);

CREATE TABLE IF NOT EXISTS reports (
  id         BIGSERIAL PRIMARY KEY,
  reporter   UUID REFERENCES users(id) ON DELETE SET NULL,
  reported   UUID REFERENCES users(id) ON DELETE SET NULL,
  reason     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
