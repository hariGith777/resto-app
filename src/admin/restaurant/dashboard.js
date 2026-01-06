export const handler = async ({ queryStringParameters }, _, { db }) => {
  const { restaurantId } = queryStringParameters || {};
  const res = await db.query("SELECT * FROM restaurants WHERE id=$1", [restaurantId]);
  return { statusCode: 200, body: JSON.stringify(res.rows[0] || {}) };
};
