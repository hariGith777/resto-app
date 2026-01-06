export const handler = async ({ queryStringParameters }, _, { db }) => {
  const { restaurantId } = queryStringParameters || {};
  const res = await db.query(
    "SELECT cp.id, cp.phone, cp.name, COUNT(o.id) as orders FROM customer_profiles cp LEFT JOIN customers c ON c.customer_profile_id=cp.id LEFT JOIN orders o ON o.session_id=c.session_id WHERE cp.restaurant_id=$1 GROUP BY cp.id",
    [restaurantId]
  );
  return { statusCode: 200, body: JSON.stringify(res.rows) };
};
