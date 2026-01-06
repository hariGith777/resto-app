import { db } from "../../common/db.js";

export const handler = async ({ body }) => {
  try {
    const { branchId, name } = JSON.parse(body);
    const res = await db.query(
      "INSERT INTO areas(branch_id,name) VALUES($1,$2) RETURNING id",
      [branchId, name]
    );
    return { statusCode: 201, body: JSON.stringify({ areaId: res.rows[0].id }) };
  } catch (error) {
    console.error('Create area error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
