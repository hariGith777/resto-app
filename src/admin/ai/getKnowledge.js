import { db } from "../../common/db.js";

export const handler = async ({ queryStringParameters }) => {
  const { restaurantId } = queryStringParameters || {};
  const res = await db.query("SELECT * FROM ai_knowledge_base WHERE restaurant_id=$1 ORDER BY id", [restaurantId]);
  return { statusCode: 200, body: JSON.stringify(res.rows) };
};
