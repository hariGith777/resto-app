import jwt from "jsonwebtoken";
import { db } from "./db.js";
import { verifyCognitoToken } from "./cognitoAuth.js";

/**
 * Verify token - supports both Cognito JWT and legacy JWT
 * Cognito tokens are used for staff/admin authentication
 * Legacy JWT tokens are used for customer authentication
 */
export const verifyToken = async (token) => {
  try {
    if (!token) throw new Error("Missing token");
    
    const cleanToken = token.replace(/^Bearer\s+/i, "");
    
    // Check if it's a Cognito token (Cognito JWTs have specific format)
    // Cognito tokens have 3 parts and the payload contains 'cognito' issuer
    try {
      const parts = cleanToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        
        // If token has Cognito issuer, verify with Cognito
        if (payload.iss && payload.iss.includes('cognito')) {
          const cognitoPayload = await verifyCognitoToken(token);
          return cognitoPayload;
        }
      }
    } catch (err) {
      // Not a Cognito token or failed to parse, try legacy JWT
    }
    
    // Fall back to legacy JWT verification for customers
    return jwt.verify(cleanToken, process.env.JWT_SECRET);
  } catch (error) {
    console.error('Token verification error:', error);
    throw error;
  }
};

export const requireSession = async (token) => {
  try {
    const payload = await verifyToken(token);
    const res = await db.query("SELECT * FROM table_sessions WHERE id=$1", [payload.sessionId]);
    if (!res.rowCount) throw new Error("Invalid session");
    return payload;
  } catch (error) {
    console.error('Require session error:', error);
    throw error;
  }
};

export const requireRole = async (token, role) => {
  try {
    const payload = await verifyToken(token);
    if (!payload.role) throw new Error('Missing role in token');
    if (payload.role !== role) throw new Error('Insufficient role');
    return payload;
  } catch (error) {
    console.error('Require role error:', error);
    throw error;
  }
};
