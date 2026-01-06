export const handler = async ({ body }, _, { db }) => {
  try {
    const { branchId, name, role, phone, username } = JSON.parse(body);
    await db.query(
      "INSERT INTO staff(branch_id,name,role,phone,username) VALUES($1,$2,$3,$4,$5)",
      [branchId, name, role, phone || null, username || null]
    );
    return { statusCode: 201, body: "Created" };
  } catch (error) {
    console.error('Create staff error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
