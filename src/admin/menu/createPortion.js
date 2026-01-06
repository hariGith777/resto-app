export const handler = async ({ body }, _, { db }) => {
  const { itemId, name, price } = JSON.parse(body);
  await db.query("INSERT INTO item_portions(item_id,name,price) VALUES($1,$2,$3)", [itemId, name, price]);
  return { statusCode: 201, body: "Created" };
};
