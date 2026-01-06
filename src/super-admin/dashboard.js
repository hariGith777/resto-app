export const handler = async ({ queryStringParameters }, _, { db }) => {
  try {
    const stats = await db.query("SELECT COUNT(*) as restaurants FROM restaurants");
    return { statusCode: 200, body: JSON.stringify({ restaurants: stats.rows[0].restaurants }) };
  } catch (error) {
    console.error('Dashboard error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
