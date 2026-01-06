import jwt from "jsonwebtoken";
import { db } from "../../common/db.js";
import { ok } from "../../common/response.js";

export const handler = async ({ body }) => {
  const { sessionId, phone, otp } = JSON.parse(body);

  const result = await db.query(
    `UPDATE otp_requests
     SET verified_at=now()
     WHERE session_id=$1 AND customer_phone=$2 AND otp_code=$3
     RETURNING id`,
    [sessionId, phone, otp]
  );

  if (!result.rowCount) {
    throw new Error("Invalid OTP");
  }

  const token = jwt.sign({ sessionId }, process.env.JWT_SECRET);
  return ok({ token });
};
