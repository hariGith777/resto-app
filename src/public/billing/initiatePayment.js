export const handler = async ({ body }, _, { db }) => {
  try {
    const { orderId, amount, method } = JSON.parse(body);
    await db.query(
      `INSERT INTO payments(order_id,amount,method,status)
       VALUES($1,$2,$3,'PENDING')`,
      [orderId, amount, method]
    );
    return { statusCode: 200, body: "Payment initiated" };
  } catch (error) {
    console.error('Initiate payment error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
