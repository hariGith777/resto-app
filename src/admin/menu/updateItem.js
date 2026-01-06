export const handler = async ({ body }, _, { db }) => {
  try {
    const { itemId, updates } = JSON.parse(body);
    const fields = [];
    const values = [];
    let idx = 1;
    Object.entries(updates).forEach(([k, v]) => {
      fields.push(`${k}=$${idx++}`);
      values.push(v);
    });
    values.push(itemId);
    await db.query(`UPDATE menu_items SET ${fields.join(",")} WHERE id=$${idx}`, values);
    return { statusCode: 200, body: "Updated" };
  } catch (error) {
    console.error('Update menu item error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
