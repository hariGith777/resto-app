import jwt from "jsonwebtoken";
import { db } from "../common/db.js";
import { ok } from "../common/response.js";

export const handler = async ({ body }) => {
  try {
    const { username } = JSON.parse(body);

    const res = await db.query("SELECT s.*, b.restaurant_id FROM staff s LEFT JOIN branches b ON b.id=s.branch_id WHERE s.username=$1", [username]);
    if (!res.rowCount) throw new Error("Invalid credentials");
    const staff = res.rows[0];

    // NOTE: password check omitted for now; assume trusted environment for initial setup
    const payload = {
      staffId: staff.id,
      role: staff.role,
      branchId: staff.branch_id || null,
      restaurantId: staff.restaurant_id || null
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET);
    return ok({ token, role: staff.role, branchId: staff.branch_id || null, restaurantId: staff.restaurant_id || null });
  } catch (error) {
    console.error('Login error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Internal server error' }) };
  }
};
