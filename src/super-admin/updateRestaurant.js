import { db } from "../common/db.js";
import { verifyToken } from "../common/auth.js";

export const handler = async ({ pathParameters, body, headers }) => {
  try {
    const token = headers?.authorization || headers?.Authorization;
    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ error: "Missing authorization" }) };
    }

    const payload = verifyToken(token);
    if (payload.role !== "SUPER_ADMIN") {
      return { statusCode: 403, body: JSON.stringify({ error: "Super admin access required" }) };
    }

    const { id } = pathParameters;
    const { name, primaryColor, secondaryColor, status, isActive } = JSON.parse(body || '{}');

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (primaryColor !== undefined) {
      updates.push(`primary_color = $${paramCount++}`);
      values.push(primaryColor);
    }
    if (secondaryColor !== undefined) {
      updates.push(`secondary_color = $${paramCount++}`);
      values.push(secondaryColor);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }
    if (isActive !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(isActive);
    }

    if (updates.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "No fields to update" }) };
    }

    values.push(id);
    const result = await db.query(
      `UPDATE restaurants 
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    if (!result.rowCount) {
      return { statusCode: 404, body: JSON.stringify({ error: "Restaurant not found" }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Restaurant updated successfully",
        restaurant: result.rows[0]
      })
    };
  } catch (error) {
    console.error("Update restaurant error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal server error" }) };
  }
};
