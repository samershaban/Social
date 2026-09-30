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

  // Ticketing. capacity and tickets_reserved are denormalized counters over the tickets rows,
  // following the review_count/rating_total precedent above, so a list of events needs no join.
  await query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS capacity INT NOT NULL DEFAULT 0`);
  await query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS tickets_reserved INT NOT NULL DEFAULT 0`);
  await query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS max_per_user INT NOT NULL DEFAULT 4`);

  // One row per seat, created up front when an event is created. user_id IS NULL means the seat
  // is free, so reserving is a single conditional UPDATE that claims a row -- which is what makes
  // concurrent reservations safe without a transaction API.
  await query(`
    CREATE TABLE IF NOT EXISTS tickets (
      id SERIAL PRIMARY KEY,
      event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      user_id INT REFERENCES users(id) ON DELETE SET NULL,
      seat_number INT NOT NULL CHECK (seat_number > 0),
      reserved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (event_id, seat_number)
    )
  `);

  // The UNIQUE (event_id, seat_number) index already covers lookups by event.
  await query(`CREATE INDEX IF NOT EXISTS tickets_user_id_idx ON tickets (user_id)`);
  // Partial index for the hot path: finding the lowest-numbered free seat for an event.
  await query(`
    CREATE INDEX IF NOT EXISTS tickets_available_idx
    ON tickets (event_id, seat_number) WHERE user_id IS NULL
  `);

  // Self-heals the counters on boot, the way the businesses backfill above does. Needed because
  // tickets.user_id is ON DELETE SET NULL: deleting a user frees their seats without touching
  // events.tickets_reserved.
  await query(`
    UPDATE events e
    SET capacity = sub.total, tickets_reserved = sub.reserved
    FROM (
      SELECT event_id, COUNT(*)::int AS total, COUNT(user_id)::int AS reserved
      FROM tickets
      GROUP BY event_id
    ) sub
    WHERE e.id = sub.event_id
      AND (e.capacity <> sub.total OR e.tickets_reserved <> sub.reserved)
  `);
}
