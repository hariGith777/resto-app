export const handler = async ({ queryStringParameters }, _, { db }) => {
  try {
    const { categoryId } = queryStringParameters || {};
    const res = await db.query(
      "SELECT * FROM menu_items WHERE category_id=$1 AND is_available=true",
      [categoryId]
    );
    return { statusCode: 200, body: JSON.stringify(res.rows) };
  } catch (error) {
    console.error('Get items error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
