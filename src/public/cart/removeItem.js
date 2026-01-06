export const handler = async ({ body }, _, { db }) => {
  try {
    const { orderItemId } = JSON.parse(body);
    await db.query("DELETE FROM order_items WHERE id=$1", [orderItemId]);
    return { statusCode: 200, body: "Removed" };
  } catch (error) {
    console.error('Remove cart item error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
