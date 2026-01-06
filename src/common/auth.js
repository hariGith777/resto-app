import jwt from "jsonwebtoken";
import { db } from "./db.js";

export const verifyToken = (token) => {
  try {
    if (!token) throw new Error("Missing token");
    return jwt.verify(token.replace(/^Bearer\s+/i, ""), process.env.JWT_SECRET);
  } catch (error) {
    console.error('Token verification error:', error);
    throw error;
  }
};

export const requireSession = async (token) => {
  try {
    const payload = verifyToken(token);
    const res = await db.query("SELECT * FROM table_sessions WHERE id=$1", [payload.sessionId]);
    if (!res.rowCount) throw new Error("Invalid session");
    return payload;
  } catch (error) {
    console.error('Require session error:', error);
    throw error;
  }
};

export const requireRole = (token, role) => {
  try {
    const payload = verifyToken(token);
    if (!payload.role) throw new Error('Missing role in token');
    if (payload.role !== role) throw new Error('Insufficient role');
    return payload;
  } catch (error) {
    console.error('Require role error:', error);
    throw error;
  }
};
