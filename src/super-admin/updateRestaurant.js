import { db } from "../common/db.js";
import { requireRole } from "../common/auth.js";

export const handler = async (event) => {
  try {
    const token = event.headers?.authorization || event.headers?.Authorization;
    requireRole(token, 'SUPER_ADMIN');

    const { id } = event.pathParameters;
    const { name, primaryColor, secondaryColor, status, isActive } = JSON.parse(event.body || '{}');

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
