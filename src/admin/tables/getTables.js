import { db } from "../../common/db.js";

export const handler = async ({ queryStringParameters }) => {
  try {
    const { areaId } = queryStringParameters || {};
    const res = await db.query("SELECT * FROM tables WHERE area_id=$1 ORDER BY id", [areaId]);
    return { statusCode: 200, body: JSON.stringify(res.rows) };
  } catch (error) {
    console.error('Get tables error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
