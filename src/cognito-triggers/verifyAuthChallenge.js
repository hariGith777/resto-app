import { db } from "../common/db.js";

/**
 * Verify Auth Challenge Lambda Trigger
 * Validates the OTP provided by user
 */
export const handler = async (event) => {
  console.log('Verify Auth Challenge Event:', JSON.stringify(event, null, 2));

  const userAnswer = event.request.challengeAnswer;
  const phoneNumber = event.request.userAttributes.phone_number;

  try {
    // Check OTP from database
    const result = await db.query(
      `SELECT otp, expires_at FROM otp_verifications 
       WHERE phone = $1`,
      [phoneNumber]
    );

    if (result.rows.length === 0) {
      console.log('No OTP found in database');
      event.response.answerCorrect = false;
      return event;
    }

    const { otp, expires_at } = result.rows[0];
    const now = new Date();

    // Check if OTP is expired
    if (new Date(expires_at) < now) {
      console.log('OTP expired');
      event.response.answerCorrect = false;
      return event;
    }

    // Compare OTP
    if (userAnswer === otp) {
      event.response.answerCorrect = true;
      console.log('OTP verification: SUCCESS');
      
      // Optionally delete the OTP after successful verification
      await db.query('DELETE FROM otp_verifications WHERE phone = $1', [phoneNumber]);
    } else {
      event.response.answerCorrect = false;
      console.log('OTP verification: FAILED - incorrect OTP');
    }
  } catch (error) {
    console.error('Error verifying OTP:', error);
    event.response.answerCorrect = false;
  }

  return event;
};
