import { db } from "../common/db.js";
import { verifyToken } from "../common/auth.js";

export const handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  
  try {
    console.log('WebSocket connect event:', JSON.stringify(event));
    
    // Extract token from query string
    const token = event.queryStringParameters?.token;
    if (!token) {
      console.log('No token provided');
      return { statusCode: 401, body: 'Authorization token required' };
    }

    console.log('Token received, verifying...');
    
    // Verify staff authentication
    const payload = verifyToken(token);
    console.log('Token verified:', { staffId: payload.staffId, role: payload.role, branchId: payload.branchId });
    
    // Store connection in database
    console.log('Storing connection in database...');
    await db.query(
      `INSERT INTO websocket_connections(connection_id, staff_id, branch_id, connection_type)
       VALUES($1, $2, $3, $4)
       ON CONFLICT (connection_id) DO UPDATE 
       SET last_ping_at = NOW()`,
      [connectionId, payload.staffId, payload.branchId, payload.role === 'KITCHEN' ? 'KITCHEN' : 'CAPTAIN']
    );

    console.log(`WebSocket connected: ${connectionId} (${payload.role} - Branch ${payload.branchId})`);
    
    return { statusCode: 200, body: 'Connected' };
  } catch (error) {
    console.error('WebSocket connect error:', error);
    console.error('Error stack:', error.stack);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
