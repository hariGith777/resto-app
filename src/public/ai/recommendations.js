export const handler = async ({ queryStringParameters }, _, { db }) => {
  const { customerProfileId } = queryStringParameters || {};

  const prefs = await db.query(
    "SELECT * FROM customer_preferences WHERE customer_profile_id=$1",
    [customerProfileId]
  );

  return {
    statusCode: 200,
    body: JSON.stringify({ preferences: prefs.rows })
  };
};
