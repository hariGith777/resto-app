import { db } from "../../common/db.js";
import { verifyToken } from "../../common/auth.js";

export const handler = async ({ body, headers }) => {
  try {
    // Verify admin authentication
    const token = headers?.authorization || headers?.Authorization;
    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Authorization token required' }) };
    }

    const payload = await verifyToken(token);
    
    // Only RESTAURANT_ADMIN can create tables
    if (payload.role !== 'RESTAURANT_ADMIN') {
      return { statusCode: 403, body: JSON.stringify({ error: 'Admin access required' }) };
    }

    if (!payload.branchId) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Branch context required' }) };
    }

    const { areaId, tableNumber, capacity } = JSON.parse(body);

    const res = await db.query(
      `INSERT INTO tables(area_id,table_number,capacity,created_at)
       VALUES($1,$2,$3,now()) RETURNING id`,
      [areaId, tableNumber, capacity]
    );

    const tableId = res.rows[0].id;

    // Generate a simple QR token/URL — placeholder implementation
    const qr = `qr:table:${tableId}`;
    await db.query("UPDATE tables SET qr_code=$1 WHERE id=$2", [qr, tableId]);

    return { statusCode: 201, body: JSON.stringify({ tableId, qr }) };
  } catch (error) {
    console.error('Create table error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
