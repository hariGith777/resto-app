import crypto from 'crypto';
import { db } from "../common/db.js";

/**
 * Create Auth Challenge Lambda Trigger
 * Generates and sends OTP to user's phone
 */
export const handler = async (event) => {
  console.log('Create Auth Challenge Event:', JSON.stringify(event, null, 2));

  if (event.request.challengeName === 'CUSTOM_CHALLENGE') {
    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    
    // Store OTP in database with 5-minute expiry
    const phoneNumber = event.request.userAttributes.phone_number;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    
    try {
      // Store OTP in database (reuse existing otp_verifications table or create new one)
      await db.query(
        `INSERT INTO otp_verifications (phone, otp, expires_at, created_at) 
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (phone) 
         DO UPDATE SET otp = $2, expires_at = $3, created_at = NOW()`,
        [phoneNumber, otp, expiresAt]
      );

      console.log(`OTP generated for ${phoneNumber}: ${otp}`);
      
      // In production, integrate with SMS service (AWS SNS, Twilio, etc.)
      // For now, we'll just log it
      // await sendSMS(phoneNumber, `Your OTP is: ${otp}`);
      
      // Set the challenge metadata (not visible to client)
      event.response.publicChallengeParameters = {
        phone: phoneNumber
      };
      
      // Store the OTP in private parameters (used for verification)
      event.response.privateChallengeParameters = {
        otp: otp
      };
      
      event.response.challengeMetadata = `OTP_${Date.now()}`;
    } catch (error) {
      console.error('Error creating auth challenge:', error);
      throw error;
    }
  }

  return event;
};
