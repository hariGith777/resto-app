export const handler = async ({ body }, _, { db }) => {
  const { restaurantId, content } = JSON.parse(body);
  await db.query("INSERT INTO ai_knowledge(restaurant_id,content) VALUES($1,$2)", [restaurantId, content]);
  return { statusCode: 201, body: "Added" };
};
