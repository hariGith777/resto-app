import { db } from "../../common/db.js";
import { created } from "../../common/response.js";

export const handler = async ({ body }) => {
  const { tableId } = JSON.parse(body);

  const { rows } = await db.query(
    "INSERT INTO table_sessions(table_id) VALUES($1) RETURNING id",
    [tableId]
  );

  return created({ sessionId: rows[0].id });
};
