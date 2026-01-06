export const handler = async ({ queryStringParameters }, _, { db }) => {
  try {
    const { itemId } = queryStringParameters || {};
    const res = await db.query("SELECT * FROM menu_items WHERE id=$1", [itemId]);
    if (!res.rowCount) return { statusCode: 404, body: "Not found" };
    return { statusCode: 200, body: JSON.stringify(res.rows[0]) };
  } catch (error) {
    console.error('Get menu item error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
