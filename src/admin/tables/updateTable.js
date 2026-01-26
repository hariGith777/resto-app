import { db } from "../../common/db.js";
import { verifyToken } from "../../common/auth.js";

export const handler = async ({ pathParameters, body, headers }) => {
  try {
    const token = headers?.authorization || headers?.Authorization;
    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ error: "Missing authorization" }) };
    }

    const payload = await verifyToken(token);
    if (!["ADMIN", "RESTAURANT_ADMIN"].includes(payload.role)) {
      return { statusCode: 403, body: JSON.stringify({ error: "Admin access required" }) };
    }

    const { id } = pathParameters;
    const { tableNumber, capacity, qrCode, isActive } = JSON.parse(body || '{}');

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (tableNumber !== undefined) {
      updates.push(`table_number = $${paramCount++}`);
      values.push(tableNumber);
    }
    if (capacity !== undefined) {
      updates.push(`capacity = $${paramCount++}`);
      values.push(capacity);
    }
    if (qrCode !== undefined) {
      updates.push(`qr_code = $${paramCount++}`);
      values.push(qrCode);
    }
    if (isActive !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(isActive);
    }

    if (updates.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "No fields to update" }) };
    }

    values.push(id);
    values.push(payload.branchId);
    
    const result = await db.query(
      `UPDATE tables t
       SET ${updates.join(', ')}, updated_at = NOW()
       FROM areas a
       WHERE t.id = $${paramCount} AND t.area_id = a.id AND a.branch_id = $${paramCount + 1}
       RETURNING t.*`,
      values
    );

    if (!result.rowCount) {
      return { statusCode: 404, body: JSON.stringify({ error: "Table not found or access denied" }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Table updated successfully",
        table: result.rows[0]
      })
    };
  } catch (error) {
    console.error("Update table error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal server error" }) };
  }
};
