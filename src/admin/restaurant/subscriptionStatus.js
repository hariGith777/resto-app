export const handler = async ({ queryStringParameters }, _, { db }) => {
  const { restaurantId } = queryStringParameters || {};
  const res = await db.query(
    "SELECT * FROM restaurant_subscriptions WHERE restaurant_id=$1 ORDER BY created_at DESC LIMIT 1",
    [restaurantId]
  );
  return { statusCode: 200, body: JSON.stringify(res.rows[0] || {}) };
};
