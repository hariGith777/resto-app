import { db } from "../../common/db.js";
import { verifyToken } from "../../common/auth.js";

export const handler = async ({ pathParameters, body, headers }) => {
  try {
    const token = headers?.authorization || headers?.Authorization;
    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ error: "Missing authorization" }) };
    }

    const payload = verifyToken(token);
    if (!["ADMIN", "RESTAURANT_ADMIN"].includes(payload.role)) {
      return { statusCode: 403, body: JSON.stringify({ error: "Admin access required" }) };
    }

    const { id } = pathParameters;
    const { name, displayOrder, isActive } = JSON.parse(body || '{}');

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (displayOrder !== undefined) {
      updates.push(`display_order = $${paramCount++}`);
      values.push(displayOrder);
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
      `UPDATE menu_categories 
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount} AND branch_id = $${paramCount + 1}
       RETURNING *`,
      values
    );

    if (!result.rowCount) {
      return { statusCode: 404, body: JSON.stringify({ error: "Category not found or access denied" }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Category updated successfully",
        category: result.rows[0]
      })
    };
  } catch (error) {
    console.error("Update category error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal server error" }) };
  }
};
