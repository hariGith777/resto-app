import { db } from "../common/db.js";

export const handler = async ({ body }) => {
  try {
    const { sessionId } = JSON.parse(body);
    await db.query("UPDATE table_sessions SET closed_at=now() WHERE id=$1", [sessionId]);
    return { statusCode: 200, body: "Closed" };
  } catch (error) {
    console.error('Close session error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
