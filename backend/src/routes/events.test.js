import { describe, expect, it } from 'vitest';
import { buildEventFilters, dayBoundsUtc, parseEventDate, readEventBody } from './events.js';

const LIMIT = 50;

function build(filters) {
  return buildEventFilters({ limit: LIMIT, ...filters });
}

describe('buildEventFilters', () => {
  it('hides past events and takes no parameters when nothing is filtered', () => {
    const { where, order, params } = build({});
    expect(where).toBe('WHERE e.event_date >= NOW()');
    expect(order).toBe('ORDER BY e.event_date ASC, e.id ASC');
    expect(params).toEqual([LIMIT]);
  });

  it('numbers a lone text query as $1 and keeps the limit last', () => {
    const { where, params } = build({ q: 'swift' });
    expect(where).toContain("e.search_vector @@ websearch_to_tsquery('english', $1)");
    expect(params).toEqual(['swift', LIMIT]);
  });

  it('reuses the query placeholder for ranking instead of binding it twice', () => {
    const { where, order, params } = build({ q: 'swift' });
    const placeholder = where.match(/websearch_to_tsquery\('english', (\$\d+)\)/)[1];
    expect(order).toContain(`ts_rank(e.search_vector, websearch_to_tsquery('english', ${placeholder}))`);
    expect(order.startsWith('ORDER BY ts_rank')).toBe(true);
    expect(params.filter((p) => p === 'swift')).toHaveLength(1);
  });

  it('turns a date into half-open UTC bounds', () => {
    const { where, params } = build({ date: dayBoundsUtc('2026-10-15') });
    expect(where).toBe('WHERE e.event_date >= $1 AND e.event_date < $2');
    expect(params).toEqual(['2026-10-15T00:00:00.000Z', '2026-10-16T00:00:00.000Z', LIMIT]);
    expect(where).not.toContain('NOW()');
  });

  it('wraps the venue clause in parentheses so the OR cannot escape the AND chain', () => {
    const { where } = build({ venue: 'o2', performer: 'adele' });
    expect(where).toContain('(v.name ILIKE $1 OR v.city ILIKE $1)');
    expect(where).toBe(
      'WHERE e.event_date >= NOW() AND (v.name ILIKE $1 OR v.city ILIKE $1) AND p.name ILIKE $2'
    );
  });

  it('matches the venue term against name and city with one parameter', () => {
    const { params } = build({ venue: 'london' });
    expect(params).toEqual(['%london%', LIMIT]);
  });

  it('combines every filter with AND in placeholder order', () => {
    const { where, params } = build({
      q: 'swift',
      date: dayBoundsUtc('2026-10-15'),
      venue: 'garden',
      performer: 'taylor',
    });
    expect(where).toBe(
      "WHERE e.search_vector @@ websearch_to_tsquery('english', $1)" +
        ' AND e.event_date >= $2 AND e.event_date < $3' +
        ' AND (v.name ILIKE $4 OR v.city ILIKE $4)' +
        ' AND p.name ILIKE $5'
    );
    expect(params).toEqual([
      'swift',
      '2026-10-15T00:00:00.000Z',
      '2026-10-16T00:00:00.000Z',
      '%garden%',
      '%taylor%',
      LIMIT,
    ]);
    expect(where.match(/\bOR\b/g)).toHaveLength(1);
  });

  it('puts the limit in the final placeholder', () => {
    const { sql, params } = build({ q: 'swift', venue: 'o2' });
    expect(sql.trimEnd().endsWith(`LIMIT $${params.length}`)).toBe(true);
  });
});

describe('dayBoundsUtc', () => {
  it('spans exactly 24 hours from UTC midnight', () => {
    const { start, end } = dayBoundsUtc('2026-10-15');
    expect(start.toISOString()).toBe('2026-10-15T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-16T00:00:00.000Z');
  });

  it('crosses a month boundary without drifting', () => {
    expect(dayBoundsUtc('2026-10-31').end.toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });

  // A US DST transition: computing the end in SQL as `+ interval '1 day'` would give 23 hours.
  it('stays 24 hours long across a DST transition', () => {
    const { start, end } = dayBoundsUtc('2027-03-14');
    expect(end - start).toBe(24 * 60 * 60 * 1000);
  });

  it('accepts a real leap day and rejects a fake one', () => {
    expect(dayBoundsUtc('2028-02-29').start.toISOString()).toBe('2028-02-29T00:00:00.000Z');
    expect(dayBoundsUtc('2027-02-29')).toBeNull();
  });

  it.each(['2026-02-30', '2026-13-01', '2026-10-32', '', 'bogus', '2026-10-15T00:00', '15/10/2026'])(
    'rejects %o',
    (value) => {
      expect(dayBoundsUtc(value)).toBeNull();
    }
  );

  it('rejects non-string input', () => {
    expect(dayBoundsUtc(null)).toBeNull();
    expect(dayBoundsUtc(20261015)).toBeNull();
  });
});

describe('parseEventDate', () => {
  it('reads a datetime-local value as the same wall clock in UTC', () => {
    expect(parseEventDate('2026-10-15T20:00').toISOString()).toBe('2026-10-15T20:00:00.000Z');
  });

  it('accepts seconds in a datetime-local value', () => {
    expect(parseEventDate('2026-10-15T20:00:30').toISOString()).toBe('2026-10-15T20:00:30.000Z');
  });

  it('passes through an explicit offset rather than re-pinning it', () => {
    expect(parseEventDate('2026-10-15T20:00:00-05:00').toISOString()).toBe('2026-10-16T01:00:00.000Z');
    expect(parseEventDate('2026-10-15T20:00:00Z').toISOString()).toBe('2026-10-15T20:00:00.000Z');
  });

  // Date.parse rolls 2026-02-30 forward to March 2 instead of failing, so the day has to be
  // range-checked explicitly or the stored date silently differs from what was submitted.
  it('rejects an impossible day instead of rolling it over', () => {
    expect(parseEventDate('2026-02-30T20:00')).toBeNull();
    expect(parseEventDate('2026-04-31T20:00')).toBeNull();
  });

  it('rejects a date without a time', () => {
    expect(parseEventDate('2026-10-15')).toBeNull();
  });

  it.each(['', '   ', 'bogus', '2026-13-01T20:00', '2026-10-15 20:00', '2026-10-15T20'])(
    'rejects %o',
    (value) => {
      expect(parseEventDate(value)).toBeNull();
    }
  );

  it('rejects non-string input', () => {
    expect(parseEventDate(null)).toBeNull();
    expect(parseEventDate(new Date())).toBeNull();
  });
});

describe('readEventBody ticket fields', () => {
  const valid = {
    title: 'Gala',
    eventDate: '2027-03-01T20:00',
    venueName: 'Royal Albert Hall',
    performerName: 'Orchestra',
  };

  it('defaults to no tickets and a per-user cap of 4', () => {
    const { values, error } = readEventBody(valid);
    expect(error).toBeUndefined();
    expect(values.capacity).toBe(0);
    expect(values.maxPerUser).toBe(4);
  });

  it('accepts numeric strings from form inputs', () => {
    const { values } = readEventBody({ ...valid, capacity: '50', maxPerUser: '2' });
    expect(values.capacity).toBe(50);
    expect(values.maxPerUser).toBe(2);
  });

  it('treats a cleared input as the default rather than as invalid', () => {
    const { values, error } = readEventBody({ ...valid, capacity: '', maxPerUser: '' });
    expect(error).toBeUndefined();
    expect(values.capacity).toBe(0);
    expect(values.maxPerUser).toBe(4);
  });

  it.each([-1, 10001, 2.5, 'abc'])('rejects capacity %o', (capacity) => {
    expect(readEventBody({ ...valid, capacity }).error).toMatch(/Capacity/);
  });

  it('accepts capacity at the boundaries', () => {
    expect(readEventBody({ ...valid, capacity: 0 }).values.capacity).toBe(0);
    expect(readEventBody({ ...valid, capacity: 10000 }).values.capacity).toBe(10000);
  });

  it.each([0, -3, 1.5, 'abc'])('rejects maxPerUser %o', (maxPerUser) => {
    expect(readEventBody({ ...valid, maxPerUser }).error).toMatch(/per user/i);
  });

  // Validation order matters: a bad date should be reported even when capacity is also wrong,
  // and a missing title should win over both.
  it('reports the missing title before any ticket problem', () => {
    expect(readEventBody({ ...valid, title: '', capacity: -1 }).error).toMatch(/title is required/);
  });
});
