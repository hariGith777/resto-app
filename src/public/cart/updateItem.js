export const handler = async ({ body }, _, { db }) => {
  try {
    const { orderItemId, qty } = JSON.parse(body);
    await db.query("UPDATE order_items SET qty=$1, updated_at=NOW() WHERE id=$2", [qty, orderItemId]);
    return { statusCode: 200, body: "Updated" };
  } catch (error) {
    console.error('Update cart item error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
