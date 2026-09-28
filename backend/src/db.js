import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function query(text, params) {
  return pool.query(text, params);
}

export async function initDb() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      bio TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS followers (
      id SERIAL PRIMARY KEY,
      follower_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      following_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id SERIAL PRIMARY KEY,
      user_a INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_b INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_a, user_b),
      CHECK (user_a < user_b)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      conversation_id INT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS businesses (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(120) NOT NULL,
      category VARCHAR(80) DEFAULT '',
      description TEXT DEFAULT '',
      address VARCHAR(255) DEFAULT '',
      review_count INT NOT NULL DEFAULT 0,
      rating_total INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS review_count INT NOT NULL DEFAULT 0`);
  await query(`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS rating_total INT NOT NULL DEFAULT 0`);

  await query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      business_id INT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
      title VARCHAR(120) DEFAULT '',
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id, business_id)
    )
  `);

  await query(`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS title VARCHAR(120) DEFAULT ''`);

  await query(`
    UPDATE businesses b
    SET review_count = sub.count, rating_total = sub.total
    FROM (
      SELECT business_id, COUNT(*)::int AS count, COALESCE(SUM(rating), 0)::int AS total
      FROM reviews
      GROUP BY business_id
    ) sub
    WHERE b.id = sub.business_id
      AND (b.review_count <> sub.count OR b.rating_total <> sub.total)
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS venues (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      city VARCHAR(120) DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS performers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      genre VARCHAR(80) DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      venue_id INT NOT NULL REFERENCES venues(id) ON DELETE RESTRICT,
      performer_id INT NOT NULL REFERENCES performers(id) ON DELETE RESTRICT,
      title VARCHAR(160) NOT NULL,
      description TEXT DEFAULT '',
      event_date TIMESTAMPTZ NOT NULL,
      search_vector tsvector,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS search_vector tsvector`);

  // First indexes in this codebase. The two unique expression indexes are required by the
  // ON CONFLICT (lower(name)) find-or-create in routes/events.js, not just an optimization.
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS venues_name_lower_idx ON venues (lower(name))`);
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS performers_name_lower_idx ON performers (lower(name))`);
  await query(`CREATE INDEX IF NOT EXISTS events_event_date_idx ON events (event_date)`);
  await query(`CREATE INDEX IF NOT EXISTS events_venue_id_idx ON events (venue_id)`);
  await query(`CREATE INDEX IF NOT EXISTS events_performer_id_idx ON events (performer_id)`);
  await query(`CREATE INDEX IF NOT EXISTS events_search_idx ON events USING GIN (search_vector)`);
}
