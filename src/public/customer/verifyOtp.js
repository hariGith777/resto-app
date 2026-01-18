import jwt from 'jsonwebtoken';
import { db } from '../../common/db.js';
import { validateSessionOpen } from '../../common/sessionValidator.js';

export const handler = async ({ body }) => {
  try {
    const { sessionId, phone, otp } = JSON.parse(body || '{}');
    if (!sessionId || !phone || !otp) return { statusCode: 400, body: JSON.stringify({ error: 'sessionId, phone and otp required' }) };

    // Validate session is OPEN
    try {
      await validateSessionOpen(sessionId);
    } catch (error) {
      if (error.message === 'SESSION_NOT_FOUND') {
        return { statusCode: 404, body: JSON.stringify({ error: 'Session not found' }) };
      }
      if (error.message === 'SESSION_CLOSED') {
        return { statusCode: 403, body: JSON.stringify({ error: 'Session is closed. Cannot verify OTP.' }) };
      }
      throw error;
    }

    // fetch latest valid OTP request (existing schema uses otp_code)
    const r = await db.query('SELECT * FROM otp_requests WHERE session_id=$1 AND customer_phone=$2 AND verified_at IS NULL AND expires_at > now() ORDER BY created_at DESC LIMIT 1', [sessionId, phone]);
    if (!r.rowCount) return { statusCode: 401, body: JSON.stringify({ error: 'No valid OTP request' }) };
    const req = r.rows[0];

    if (req.otp_code !== otp) {
      await db.query('UPDATE otp_requests SET attempts = COALESCE(attempts,0) + 1 WHERE id=$1', [req.id]);
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid OTP' }) };
    }

    // mark verified
    await db.query('UPDATE otp_requests SET verified_at = now() WHERE id=$1', [req.id]);

    // mark customer verified and return customer info
    const custRes = await db.query('UPDATE customers SET verified = true WHERE session_id=$1 AND phone=$2 RETURNING id, customer_profile_id', [sessionId, phone]);
    let customerId = null;
    let profileId = null;
    if (custRes.rowCount) {
      customerId = custRes.rows[0].id;
      profileId = custRes.rows[0].customer_profile_id;
    } else {
      const p = await db.query('SELECT id FROM customer_profiles WHERE phone=$1 LIMIT 1', [phone]);
      if (p.rowCount) profileId = p.rows[0].id;
    }

    // issue session-scoped JWT
    const payload = { sessionId, customerId, profileId, scope: 'session' };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });

    return { statusCode: 200, body: JSON.stringify({ token }) };
  } catch (error) {
    console.error('Verify OTP error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
