import { db } from '../../common/db.js';

export const handler = async ({ body }) => {
  try {
    const { sessionId, name, phone } = JSON.parse(body || '{}');
    if (!sessionId || !phone) return { statusCode: 400, body: JSON.stringify({ error: 'sessionId and phone required' }) };

    // ensure session exists
    const s = await db.query('SELECT id FROM table_sessions WHERE id=$1 LIMIT 1', [sessionId]);
    if (!s.rowCount) return { statusCode: 404, body: JSON.stringify({ error: 'Session not found' }) };

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
