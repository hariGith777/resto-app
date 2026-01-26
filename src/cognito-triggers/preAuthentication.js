import { db } from "../common/db.js";

/**
 * Pre-Authentication Lambda Trigger
 * Validates user exists and is active before authentication
 */
export const handler = async (event) => {
  console.log('Pre-Authentication Event:', JSON.stringify(event, null, 2));

  const username = event.userName;
  
  try {
    // Check if user exists and is active in our database
    const result = await db.query(
      `SELECT id, is_active, role FROM staff 
       WHERE (username = $1 OR phone = $1) AND is_active = true`,
      [username]
    );

    if (result.rowCount === 0) {
      throw new Error('User not found or inactive');
    }

    console.log(`Pre-auth successful for user: ${username}`);
    
    // Just return the event - don't modify response for pre-auth
    return event;
  } catch (error) {
    console.error('Pre-authentication error:', error);
    throw new Error('User not authorized');
  }
};
