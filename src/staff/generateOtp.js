import { db } from "../common/db.js";

export const handler = async ({ body }) => {
  try {
    const { sessionId, customerPhone } = JSON.parse(body);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await db.query(
      `INSERT INTO otp_requests(session_id,customer_phone,otp_code,created_at)
       VALUES($1,$2,$3,now())`,
      [sessionId, customerPhone, otp]
    );
    return { statusCode: 200, body: JSON.stringify({ otp }) };
  } catch (error) {
    console.error('Generate OTP error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
