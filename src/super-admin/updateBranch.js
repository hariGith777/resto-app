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
    const { name, address, currencyCode, currencySymbol, isActive } = JSON.parse(body || '{}');

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
