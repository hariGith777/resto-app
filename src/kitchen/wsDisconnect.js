import { db } from "../common/db.js";

export const handler = async (event) => {
  try {
    const connectionId = event.requestContext.connectionId;
    
    const res = await db.query(
      "DELETE FROM ws_connections WHERE connection_id = $1 RETURNING branch_id",
      [connectionId]
    );

    if (res.rowCount) {
      console.log(`✅ Kitchen disconnected: ${connectionId}`);
    }

    return { statusCode: 200 };
  } catch (error) {
    console.error("WS disconnect error:", error);
    return { statusCode: 500 };
  }
};
