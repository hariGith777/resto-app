export const handler = async ({ body }, _, { db }) => {
  const { customerProfileId, message } = JSON.parse(body);
  // Placeholder: return a canned response or preferences
  const prefs = await db.query(
    "SELECT * FROM customer_preferences WHERE customer_profile_id=$1",
    [customerProfileId]
  );
  return { statusCode: 200, body: JSON.stringify({ reply: "Here are some recommendations", preferences: prefs.rows }) };
};
