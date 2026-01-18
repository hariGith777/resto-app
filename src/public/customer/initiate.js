import { db } from '../../common/db.js';
import { validateSessionOpen } from '../../common/sessionValidator.js';

export const handler = async ({ body }) => {
  try {
    const { sessionId, name, phone } = JSON.parse(body || '{}');
    if (!sessionId || !phone) return { statusCode: 400, body: JSON.stringify({ error: 'sessionId and phone required' }) };

    // Validate session exists and is OPEN
    try {
      await validateSessionOpen(sessionId);
    } catch (error) {
      if (error.message === 'SESSION_NOT_FOUND') {
        return { statusCode: 404, body: JSON.stringify({ error: 'Session not found' }) };
      }
      if (error.message === 'SESSION_CLOSED') {
        return { statusCode: 403, body: JSON.stringify({ error: 'Session is closed. Cannot initiate customer.' }) };
      }
      throw error;
    }

    // find or create customer profile
    let res = await db.query('SELECT id FROM customer_profiles WHERE phone=$1 LIMIT 1', [phone]);
    let profileId;
    if (!res.rowCount) {
      const r = await db.query('INSERT INTO customer_profiles(phone, name) VALUES($1,$2) RETURNING id', [phone, name || null]);
      profileId = r.rows[0].id;
    } else {
      profileId = res.rows[0].id;
    }

    // create session-specific customer record (schema uses customer_profile_id)
    const c = await db.query('INSERT INTO customers(customer_profile_id, session_id, name, phone) VALUES($1,$2,$3,$4) RETURNING id', [profileId, sessionId, name || null, phone]);

    return { statusCode: 200, body: JSON.stringify({ message: 'Please ask the captain for OTP' }) };
  } catch (error) {
    console.error('Initiate customer error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
