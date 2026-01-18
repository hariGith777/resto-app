import { db } from "./db.js";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";

/**
 * Broadcast message to all kitchen WebSocket connections for a specific branch
 */
export async function broadcastToKitchen(branchId, message) {
  try {
    // Get all active kitchen connections for this branch
    const res = await db.query(
      `SELECT connection_id FROM websocket_connections 
       WHERE branch_id = $1 AND connection_type = 'KITCHEN'`,
      [branchId]
    );

    if (res.rowCount === 0) {
      console.log(`No kitchen connections for branch ${branchId}`);
      return;
    }

    // Get WebSocket API endpoint from environment
    const wsEndpoint = process.env.WEBSOCKET_API_ENDPOINT;
    if (!wsEndpoint) {
      console.error('WEBSOCKET_API_ENDPOINT not configured');
      return;
    }

    const client = new ApiGatewayManagementApiClient({
      endpoint: wsEndpoint
    });

    const messageData = JSON.stringify(message);
    const promises = res.rows.map(async (row) => {
      try {
        await client.send(new PostToConnectionCommand({
          ConnectionId: row.connection_id,
          Data: messageData
        }));
        console.log(`Sent to connection ${row.connection_id}`);
      } catch (error) {
        if (error.statusCode === 410) {
          // Connection is stale, remove from database
          console.log(`Removing stale connection: ${row.connection_id}`);
          await db.query('DELETE FROM websocket_connections WHERE connection_id = $1', [row.connection_id]);
        } else {
          console.error(`Failed to send to ${row.connection_id}:`, error);
        }
      }
    });

    await Promise.all(promises);
    console.log(`Broadcast complete to ${res.rowCount} kitchen connection(s)`);
  } catch (error) {
    console.error('Broadcast to kitchen error:', error);
  }
}

/**
 * Broadcast message to all captain WebSocket connections for a specific branch
 */
export async function broadcastToCaptain(branchId, message) {
  try {
    // Get all active captain connections for this branch
    const res = await db.query(
      `SELECT connection_id FROM websocket_connections 
       WHERE branch_id = $1 AND connection_type = 'CAPTAIN'`,
      [branchId]
    );

    if (res.rowCount === 0) {
      console.log(`No captain connections for branch ${branchId}`);
      return;
    }

    // Get WebSocket API endpoint from environment
    const wsEndpoint = process.env.WEBSOCKET_API_ENDPOINT;
    if (!wsEndpoint) {
      console.error('WEBSOCKET_API_ENDPOINT not configured');
      return;
    }

    const client = new ApiGatewayManagementApiClient({
      endpoint: wsEndpoint
    });

    const messageData = JSON.stringify(message);
    const promises = res.rows.map(async (row) => {
      try {
        await client.send(new PostToConnectionCommand({
          ConnectionId: row.connection_id,
          Data: messageData
        }));
        console.log(`Sent to captain connection ${row.connection_id}`);
      } catch (error) {
        if (error.statusCode === 410) {
          // Connection is stale, remove from database
          console.log(`Removing stale captain connection: ${row.connection_id}`);
          await db.query('DELETE FROM websocket_connections WHERE connection_id = $1', [row.connection_id]);
        } else {
          console.error(`Failed to send to captain ${row.connection_id}:`, error);
        }
      }
    });

    await Promise.all(promises);
    console.log(`Broadcast complete to ${res.rowCount} captain connection(s)`);
  } catch (error) {
    console.error('Broadcast to captain error:', error);
  }
}
