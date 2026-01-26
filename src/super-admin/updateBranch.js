import { db } from "../common/db.js";
import { requireRole } from "../common/auth.js";

export const handler = async (event) => {
  try {
    const token = event.headers?.authorization || event.headers?.Authorization;
    await requireRole(token, 'SUPER_ADMIN');

    const { id } = event.pathParameters;
    const { name, address, currencyCode, currencySymbol, isActive } = JSON.parse(event.body || '{}');

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (address !== undefined) {
      updates.push(`address = $${paramCount++}`);
      values.push(address);
    }
    if (currencyCode !== undefined) {
      updates.push(`currency_code = $${paramCount++}`);
      values.push(currencyCode);
    }
    if (currencySymbol !== undefined) {
      updates.push(`currency_symbol = $${paramCount++}`);
      values.push(currencySymbol);
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
      `UPDATE branches 
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    if (!result.rowCount) {
      return { statusCode: 404, body: JSON.stringify({ error: "Branch not found" }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Branch updated successfully",
        branch: result.rows[0]
      })
    };
  } catch (error) {
    console.error("Update branch error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal server error" }) };
  }
};
