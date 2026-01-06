export const handler = async ({ queryStringParameters }, _, { db }) => {
  try {
    const { orderId } = queryStringParameters || {};
    const res = await db.query("SELECT * FROM bills WHERE order_id=$1", [orderId]);
    if (!res.rowCount) return { statusCode: 404, body: "Not found" };
    return { statusCode: 200, body: JSON.stringify(res.rows[0]) };
  } catch (error) {
    console.error('View bill error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
