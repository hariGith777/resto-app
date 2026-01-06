export const handler = async ({ body }, _, { db }) => {
  try {
    const { orderId, menuItemId, qty, price } = JSON.parse(body);

    await db.query(
      `INSERT INTO order_items(order_id,menu_item_id,qty,price)
       VALUES($1,$2,$3,$4)`,
      [orderId, menuItemId, qty, price]
    );

    return { statusCode: 200, body: "Added" };
  } catch (error) {
    console.error('Add cart item error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
