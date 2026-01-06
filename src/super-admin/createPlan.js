export const handler = async ({ body }, _, { db }) => {
  try {
    const { name, price } = JSON.parse(body);
    const res = await db.query("INSERT INTO plans(name,price) VALUES($1,$2) RETURNING id", [name, price]);
    return { statusCode: 201, body: JSON.stringify({ planId: res.rows[0].id }) };
  } catch (error) {
    console.error('Create plan error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
