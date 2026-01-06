import { db } from "../common/db.js";
import { verifyToken } from "../common/auth.js";

export const handler = async (event) => {
  try {
    const connectionId = event.requestContext.connectionId;
    const token = event.queryStringParameters?.token;

    if (!token) {
      return { statusCode: 401, body: "Missing token" };
    }

    // Verify kitchen staff token and get branch ID
    let staffInfo;
    try {
      staffInfo = verifyToken(token);
      if (staffInfo.role !== "KITCHEN") {
        console.log(`Unauthorized connection attempt: ${staffInfo.role}`);
        return { statusCode: 403, body: "Unauthorized" };
      }
    } catch (error) {
      console.log(`Invalid token: ${error.message}`);
      return { statusCode: 401, body: "Invalid token" };
    }

    // Store connection with branch ID for filtering
    await db.query(
      `INSERT INTO ws_connections(connection_id, branch_id)
       VALUES($1, $2)
       ON CONFLICT(connection_id) DO UPDATE SET branch_id = $2`,
      [connectionId, staffInfo.branchId]
    );

    console.log(`✅ Kitchen connected: ${connectionId} (Branch: ${staffInfo.branchId})`);
    return { statusCode: 200, body: "Connected" };
  } catch (error) {
    console.error("WS connect error:", error);
    return { statusCode: 500, body: "Connection failed" };
  }
};
