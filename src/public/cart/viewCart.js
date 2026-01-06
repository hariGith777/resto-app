export const handler = async ({ queryStringParameters }, _, { db }) => {
  try {
    const { orderId } = queryStringParameters || {};
    const res = await db.query("SELECT * FROM order_items WHERE order_id=$1", [orderId]);
    return { statusCode: 200, body: JSON.stringify(res.rows) };
  } catch (error) {
    console.error('View cart error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
