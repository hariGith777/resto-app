import { db } from "../../common/db.js";
import { ok } from "../../common/response.js";

export const handler = async ({ body }) => {
  const { sessionId, name, phone } = JSON.parse(body);

  const profile = await db.query(
    `INSERT INTO customer_profiles(phone,name)
     VALUES($1,$2)
     ON CONFLICT(phone) DO UPDATE SET last_active_at=now()
     RETURNING id`,
    [phone, name]
  );

  await db.query(
    `INSERT INTO customers(session_id,customer_profile_id,name,phone)
     VALUES($1,$2,$3,$4)`,
    [sessionId, profile.rows[0].id, name, phone]
  );

  return ok({ message: "OTP required from captain" });
};
