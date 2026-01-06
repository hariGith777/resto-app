export const handler = async ({ body }, _, { db }) => {
  try {
    const { restaurantId, planId } = JSON.parse(body);

    await db.query(
      `INSERT INTO restaurant_subscriptions
       (restaurant_id,plan_id,status)
       VALUES($1,$2,'ACTIVE')`,
      [restaurantId, planId]
    );

    return { statusCode: 200, body: "Subscription assigned" };
  } catch (error) {
    console.error('Assign subscription error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
