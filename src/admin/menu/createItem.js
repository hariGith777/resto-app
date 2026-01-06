export const handler = async ({ body }, _, { db }) => {
  try {
    const data = JSON.parse(body);

    await db.query(
      `INSERT INTO menu_items(category_id,name,base_price,is_veg)
       VALUES($1,$2,$3,$4)`,
      [data.categoryId, data.name, data.price, data.isVeg]
    );

    return { statusCode: 201, body: "Created" };
  } catch (error) {
    console.error('Create menu item error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
