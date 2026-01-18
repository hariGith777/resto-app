import crypto from 'crypto';
import { db } from '../../common/db.js';
import { verifyToken } from '../../common/auth.js';

export const handler = async ({ body, headers }) => {
  try {
    const { sessionId, customerPhone } = JSON.parse(body || '{}');
    if (!sessionId || !customerPhone) return { statusCode: 400, body: JSON.stringify({ error: 'sessionId and customerPhone required' }) };

    const auth = headers && (headers.authorization || headers.Authorization);
    if (!auth) return { statusCode: 401, body: JSON.stringify({ error: 'Missing authorization' }) };

    let payload;
    try {
      payload = verifyToken(auth);
    } catch (e) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
    }

    // allow staff/captain roles
    if (!payload.role || !['CAPTAIN', 'STAFF', 'ADMIN'].includes(payload.role)) return { statusCode: 403, body: JSON.stringify({ error: 'Insufficient role' }) };

    if (!payload.staffId) return { statusCode: 403, body: JSON.stringify({ error: 'Staff context required' }) };

    // ensure session exists and capture its branch
    const sessionRes = await db.query(
      `SELECT ts.id, a.branch_id
       FROM table_sessions ts
       JOIN tables t ON ts.table_id = t.id
       JOIN areas a ON t.area_id = a.id
       WHERE ts.id = $1
       LIMIT 1`,
      [sessionId]
    );
    if (!sessionRes.rowCount) return { statusCode: 404, body: JSON.stringify({ error: 'Session not found' }) };

    // fetch staff branch
    const staffRes = await db.query('SELECT branch_id FROM staff WHERE id = $1 LIMIT 1', [payload.staffId]);
    if (!staffRes.rowCount) return { statusCode: 403, body: JSON.stringify({ error: 'Staff not found' }) };

    const sessionBranchId = sessionRes.rows[0].branch_id;
    const staffBranchId = staffRes.rows[0].branch_id;

    if (!sessionBranchId || !staffBranchId || sessionBranchId !== staffBranchId) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Branch mismatch' }) };
    }

    // Check for existing unexpired OTP in this session (even if already verified by someone)
    const existingOtpRes = await db.query(
      `SELECT otp_code, expires_at 
       FROM otp_requests 
       WHERE session_id = $1 
         AND expires_at > NOW()
       ORDER BY created_at DESC 
       LIMIT 1`,
      [sessionId]
    );

    let otp, expiresAt;
    let reused = false;

    if (existingOtpRes.rowCount > 0) {
      // Reuse existing OTP for new customer
      otp = existingOtpRes.rows[0].otp_code;
      expiresAt = existingOtpRes.rows[0].expires_at;
      reused = true;
      
      console.log(`Reusing OTP ${otp} for session ${sessionId}, customer ${customerPhone}`);
      
      // Create tracking record for this customer with same OTP
      await db.query(
        'INSERT INTO otp_requests(session_id, customer_phone, otp_code, generated_by, expires_at) VALUES($1,$2,$3,$4,$5)',
        [sessionId, customerPhone, otp, payload.staffId, expiresAt]
      );
    } else {
      // Generate new numeric OTP (6 digits)
      otp = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
      expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
      
      console.log(`Generated new OTP ${otp} for session ${sessionId}, customer ${customerPhone}`);

      // Insert new OTP record
      await db.query(
        'INSERT INTO otp_requests(session_id, customer_phone, otp_code, generated_by, expires_at) VALUES($1,$2,$3,$4,$5)',
        [sessionId, customerPhone, otp, payload.staffId, expiresAt]
      );
    }

    // return OTP to captain app with reused flag
    return { statusCode: 200, body: JSON.stringify({ otp, reused }) };
  } catch (error) {
    console.error('Generate OTP error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
