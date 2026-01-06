export const handler = async ({ body }, _, { db }) => {
  const { restaurantId, name } = JSON.parse(body);
  await db.query("INSERT INTO menu_categories(restaurant_id,name) VALUES($1,$2)", [restaurantId, name]);
  return { statusCode: 201, body: "Created" };
};
