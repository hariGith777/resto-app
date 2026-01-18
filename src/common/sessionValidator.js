import { db } from "./db.js";

/**
 * Validate that a session is OPEN and active
 * Returns session data if valid, throws error if closed/invalid
 */
export async function validateSessionOpen(sessionId) {
  const sessionRes = await db.query(
    `SELECT ts.id, ts.status, ts.started_at, ts.ended_at, ts.table_id
     FROM table_sessions ts
     WHERE ts.id = $1`,
    [sessionId]
  );

  if (!sessionRes.rowCount) {
    throw new Error('SESSION_NOT_FOUND');
  }

  const session = sessionRes.rows[0];

  if (session.status === 'CLOSED') {
    throw new Error('SESSION_CLOSED');
  }

  return session;
}
