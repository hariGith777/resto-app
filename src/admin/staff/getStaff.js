import { db } from "../../common/db.js";

export const handler = async ({ queryStringParameters }) => {
  try {
    const { branchId } = queryStringParameters || {};
    const res = await db.query("SELECT * FROM staff WHERE branch_id=$1 ORDER BY id", [branchId]);
    return { statusCode: 200, body: JSON.stringify(res.rows) };
  } catch (error) {
    console.error('Get staff error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
