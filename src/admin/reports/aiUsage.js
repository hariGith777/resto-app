export const handler = async ({ queryStringParameters }, _, { db }) => {
  const { restaurantId } = queryStringParameters || {};
  const res = await db.query("SELECT * FROM ai_usage WHERE restaurant_id=$1", [restaurantId]);
  return { statusCode: 200, body: JSON.stringify(res.rows) };
};
