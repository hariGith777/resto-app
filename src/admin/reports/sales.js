export const handler = async ({ queryStringParameters }, _, { db }) => {
  const { restaurantId, from, to } = queryStringParameters || {};
  const res = await db.query(
    `SELECT date_trunc('day', created_at) as day, SUM(total_amount) as total
     FROM orders WHERE restaurant_id=$1 AND created_at BETWEEN $2 AND $3
     GROUP BY day ORDER BY day`,
    [restaurantId, from, to]
  );
  return { statusCode: 200, body: JSON.stringify(res.rows) };
};
