import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const venuesRouter = Router();
const performersRouter = Router();

const EVENT_SELECT = `
  SELECT e.id, e.title, e.description, e.event_date, e.created_at, e.user_id, u.username,
         v.id AS venue_id, v.name AS venue_name, v.city AS venue_city,
         p.id AS performer_id, p.name AS performer_name, p.genre AS performer_genre
  FROM events e
  JOIN users u ON u.id = e.user_id
  JOIN venues v ON v.id = e.venue_id
  JOIN performers p ON p.id = e.performer_id
`;

// Resolves the venue and performer by name, creating either if it does not exist yet.
// A single statement because db.js exposes no transaction API. DO UPDATE (not DO NOTHING)
// so the row is always returned, and `SET name = <table>.name` is a no-op that keeps the
// first writer's casing instead of letting a later writer rewrite it for everyone.
const REFERENCE_UPSERT_CTE = `
  WITH v AS (
    INSERT INTO venues (name, city) VALUES ($1::text, $2::text)
    ON CONFLICT (lower(name)) DO UPDATE SET name = venues.name
    RETURNING id, name
  ), p AS (
    INSERT INTO performers (name, genre) VALUES ($3::text, $4::text)
    ON CONFLICT (lower(name)) DO UPDATE SET name = performers.name
    RETURNING id, name
  )
`;

const MAX_QUERY_LENGTH = 200;
const LOCAL_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;
const ZONED_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

// The title/description weights make a title hit outrank a description hit. The explicit
// 'english' regconfig is required: the one-argument to_tsvector is STABLE, so it cannot be
// indexed and its result would depend on the session's default_text_search_config.
function searchVectorExpr(titleParam, descriptionParam) {
  return `setweight(to_tsvector('english', coalesce($${titleParam}::text, '')), 'A') ||
          setweight(to_tsvector('english', p.name), 'B') ||
          setweight(to_tsvector('english', v.name), 'C') ||
          setweight(to_tsvector('english', coalesce($${descriptionParam}::text, '')), 'D')`;
}

function formatEvent(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    eventDate: row.event_date,
    createdAt: row.created_at,
    organizer: { id: row.user_id, username: row.username },
    venue: { id: row.venue_id, name: row.venue_name, city: row.venue_city || '' },
    performer: {
      id: row.performer_id,
      name: row.performer_name,
      genre: row.performer_genre || '',
    },
  };
}

function formatVenue(row) {
  return { id: row.id, name: row.name, city: row.city || '' };
}

function formatPerformer(row) {
  return { id: row.id, name: row.name, genre: row.genre || '' };
}

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Date.parse accepts an out-of-range day and silently rolls it over: '2026-02-30' becomes
// March 2. Only the month is range-checked for ISO input, so the day needs verifying against
// the month's real length before the value is trusted.
function isRealCalendarDate(datePart) {
  const [year, month, day] = datePart.split('-').map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

// Accepts a datetime-local value ("2026-10-15T20:00", treated as UTC) or a full ISO string
// that already carries an offset. Returns null for anything else, including impossible
// calendar dates like 2026-02-30 (see isRealCalendarDate).
export function parseEventDate(value) {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!isRealCalendarDate(trimmed.slice(0, 10))) return null;

  let iso;
  if (LOCAL_DATETIME_RE.test(trimmed)) {
    iso = trimmed.length === 16 ? `${trimmed}:00Z` : `${trimmed}Z`;
  } else if (ZONED_DATETIME_RE.test(trimmed)) {
    iso = trimmed;
  } else {
    return null;
  }

  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Half-open UTC bounds for a YYYY-MM-DD day. Both ends are explicit instants computed here
// rather than in SQL: `timestamptz + interval '1 day'` is evaluated in session-timezone
// calendar terms and is 23h or 25h across a DST boundary.
export function dayBoundsUtc(value) {
  if (typeof value !== 'string' || !DATE_ONLY_RE.test(value.trim())) return null;
  if (!isRealCalendarDate(value.trim())) return null;

  const start = new Date(`${value.trim()}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return null;

  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

// Builds the WHERE/ORDER BY for the list+search endpoint. Every clause is self-parenthesized
// because they are joined with AND: an unparenthesized OR would silently re-associate and
// return wrong rows. $n is always derived from params.length, never counted by hand.
export function buildEventFilters({ q, date, venue, performer, limit }) {
  const clauses = [];
  const params = [];
  let rankExpr = null;

  // Pushed first so its placeholder is stable enough to reuse in ORDER BY.
  if (q) {
    params.push(q);
    const placeholder = `$${params.length}`;
    clauses.push(`e.search_vector @@ websearch_to_tsquery('english', ${placeholder})`);
    rankExpr = `ts_rank(e.search_vector, websearch_to_tsquery('english', ${placeholder}))`;
  }

  if (date) {
    params.push(date.start.toISOString());
    clauses.push(`e.event_date >= $${params.length}`);
    params.push(date.end.toISOString());
    clauses.push(`e.event_date < $${params.length}`);
  } else {
    // Ascending order only makes sense over a forward-looking set, so hide past events
    // unless the caller asked for a specific day.
    clauses.push('e.event_date >= NOW()');
  }

  if (venue) {
    params.push(`%${venue}%`);
    clauses.push(`(v.name ILIKE $${params.length} OR v.city ILIKE $${params.length})`);
  }

  if (performer) {
    params.push(`%${performer}%`);
    clauses.push(`p.name ILIKE $${params.length}`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const order = rankExpr
    ? `ORDER BY ${rankExpr} DESC, e.event_date ASC, e.id ASC`
    : 'ORDER BY e.event_date ASC, e.id ASC';

  params.push(limit);

  return { sql: `${EVENT_SELECT} ${where} ${order} LIMIT $${params.length}`, params, where, order };
}

async function getEvent(id) {
  const result = await query(`${EVENT_SELECT} WHERE e.id = $1`, [id]);
  return result.rows[0] ?? null;
}

// Shared by POST and PUT. Returns { error } or { values }; length limits are checked here so
// an overlong field is a 400 rather than a "value too long for type" 500 from Postgres.
function readEventBody(body) {
  const title = body.title?.trim() || '';
  const description = body.description?.trim() || '';
  const venueName = body.venueName?.trim() || '';
  const venueCity = body.venueCity?.trim() || '';
  const performerName = body.performerName?.trim() || '';
  const performerGenre = body.performerGenre?.trim() || '';

  if (!title) return { error: 'Event title is required' };
  if (title.length > 160) return { error: 'Event title must be 160 characters or fewer' };
  if (!venueName) return { error: 'Venue name is required' };
  if (venueName.length > 120) return { error: 'Venue name must be 120 characters or fewer' };
  if (venueCity.length > 120) return { error: 'Venue city must be 120 characters or fewer' };
  if (!performerName) return { error: 'Performer name is required' };
  if (performerName.length > 120) return { error: 'Performer name must be 120 characters or fewer' };
  if (performerGenre.length > 80) return { error: 'Performer genre must be 80 characters or fewer' };

  const eventDate = parseEventDate(body.eventDate);
  if (!eventDate) {
    return { error: 'Invalid event date, expected YYYY-MM-DDTHH:mm' };
  }

  return {
    values: { title, description, venueName, venueCity, performerName, performerGenre, eventDate },
  };
}

// GET /api/events is the search endpoint: every filter is optional and they combine with AND,
// so there is nothing for a separate /search route to do.
router.get('/', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const venue = typeof req.query.venue === 'string' ? req.query.venue.trim() : '';
  const performer = typeof req.query.performer === 'string' ? req.query.performer.trim() : '';
  const rawDate = typeof req.query.date === 'string' ? req.query.date.trim() : '';

  if (q.length > MAX_QUERY_LENGTH) {
    return res.status(400).json({ error: `Search query must be ${MAX_QUERY_LENGTH} characters or fewer` });
  }

  let date = null;
  if (rawDate) {
    date = dayBoundsUtc(rawDate);
    if (!date) {
      return res.status(400).json({ error: 'Invalid date, expected YYYY-MM-DD' });
    }
  }

  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);

  try {
    const { sql, params } = buildEventFilters({ q, date, venue, performer, limit });
    const result = await query(sql, params);
    res.json(result.rows.map(formatEvent));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

router.get('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(404).json({ error: 'Event not found' });
  }

  try {
    const event = await getEvent(id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(formatEvent(event));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const { error, values } = readEventBody(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const result = await query(
      `${REFERENCE_UPSERT_CTE}
       INSERT INTO events (user_id, venue_id, performer_id, title, description, event_date, search_vector)
       SELECT $5, v.id, p.id, $6::text, $7::text, $8::timestamptz, ${searchVectorExpr(6, 7)}
       FROM v, p
       RETURNING id`,
      [
        values.venueName,
        values.venueCity,
        values.performerName,
        values.performerGenre,
        req.userId,
        values.title,
        values.description,
        values.eventDate.toISOString(),
      ]
    );

    const created = await getEvent(result.rows[0].id);
    res.status(201).json(formatEvent(created));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(404).json({ error: 'Event not found' });
  }

  const { error, values } = readEventBody(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const existing = await query('SELECT user_id FROM events WHERE id = $1', [id]);
    const event = existing.rows[0];
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    if (event.user_id !== req.userId) {
      return res.status(403).json({ error: 'You can only edit your own events' });
    }

    // search_vector is recomputed here so an edited title is searchable immediately.
    await query(
      `${REFERENCE_UPSERT_CTE}
       UPDATE events SET
         venue_id = v.id,
         performer_id = p.id,
         title = $6::text,
         description = $7::text,
         event_date = $8::timestamptz,
         search_vector = ${searchVectorExpr(6, 7)}
       FROM v, p
       WHERE events.id = $5`,
      [
        values.venueName,
        values.venueCity,
        values.performerName,
        values.performerGenre,
        id,
        values.title,
        values.description,
        values.eventDate.toISOString(),
      ]
    );

    const updated = await getEvent(id);
    res.json(formatEvent(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(404).json({ error: 'Event not found' });
  }

  try {
    const existing = await query('SELECT user_id FROM events WHERE id = $1', [id]);
    const event = existing.rows[0];
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    if (event.user_id !== req.userId) {
      return res.status(403).json({ error: 'You can only delete your own events' });
    }

    await query('DELETE FROM events WHERE id = $1', [id]);
    res.json({ message: 'Event deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// Venues and performers are reference data, created implicitly when an event names them.
// They are read-only over HTTP on purpose: there is no admin role to decide who may rename
// a shared venue, and immutable names are what keeps events.search_vector from going stale.
venuesRouter.get('/', async (_req, res) => {
  try {
    const result = await query('SELECT id, name, city FROM venues ORDER BY name');
    res.json(result.rows.map(formatVenue));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch venues' });
  }
});

performersRouter.get('/', async (_req, res) => {
  try {
    const result = await query('SELECT id, name, genre FROM performers ORDER BY name');
    res.json(result.rows.map(formatPerformer));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch performers' });
  }
});

export { venuesRouter, performersRouter };
export default router;
