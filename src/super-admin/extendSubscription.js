export const handler = async ({ body }, _, { db }) => {
  try {
    const { subscriptionId, extraDays } = JSON.parse(body);
    await db.query("UPDATE restaurant_subscriptions SET expires_at = expires_at + ($1::int * interval '1 day') WHERE id=$2", [extraDays, subscriptionId]);
    return { statusCode: 200, body: "Extended" };
  } catch (error) {
    console.error('Extend subscription error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
