import { db } from "../common/db.js";

export const handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  
  try {
    // Remove connection from database
    await db.query(
      'DELETE FROM websocket_connections WHERE connection_id = $1',
      [connectionId]
    );

    console.log(`WebSocket disconnected: ${connectionId}`);
    
    return { statusCode: 200, body: 'Disconnected' };
  } catch (error) {
    console.error('WebSocket disconnect error:', error);
    return { statusCode: 500, body: 'Disconnect failed' };
  }
};
