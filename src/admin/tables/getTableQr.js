import { db } from "../../common/db.js";

export const handler = async ({ pathParameters }) => {
  const { tableId } = pathParameters || {};
  const res = await db.query("SELECT qr_code FROM tables WHERE id=$1", [tableId]);
  if (!res.rowCount) return { statusCode: 404, body: "Not found" };
  return { statusCode: 200, body: JSON.stringify({ qr: res.rows[0].qr_code }) };
};
