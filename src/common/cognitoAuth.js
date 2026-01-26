import { CognitoJwtVerifier } from "aws-jwt-verify";
import { 
  CognitoIdentityProviderClient, 
  AdminInitiateAuthCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  AdminGetUserCommand,
  RespondToAuthChallengeCommand
} from "@aws-sdk/client-cognito-identity-provider";

const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const COGNITO_APP_CLIENT_ID = process.env.COGNITO_APP_CLIENT_ID;
const COGNITO_REGION = process.env.COGNITO_REGION || 'ap-south-1';

// Initialize Cognito client
const cognitoClient = new CognitoIdentityProviderClient({ 
  region: COGNITO_REGION 
});

// JWT verifier for Cognito ID tokens
const idTokenVerifier = CognitoJwtVerifier.create({
  userPoolId: COGNITO_USER_POOL_ID,
  tokenUse: "id",
  clientId: COGNITO_APP_CLIENT_ID,
});

/**
 * Verify Cognito ID token
 * ID tokens contain custom attributes like custom:role, custom:staffId, etc.
 */
export const verifyCognitoToken = async (token) => {
  try {
    const cleanToken = token.replace(/^Bearer\s+/i, "");
    const payload = await idTokenVerifier.verify(cleanToken);
    
    // ID token has custom attributes with 'custom:' prefix
    return {
      sub: payload.sub,
      username: payload['cognito:username'],
      role: payload['custom:role'],
      staffId: payload['custom:staffId'],
      branchId: payload['custom:branchId'] || null,
      restaurantId: payload['custom:restaurantId'] || null,
      phone: payload.phone_number || null,
      isCognito: true
    };
  } catch (error) {
    console.error('Cognito token verification failed:', error);
    throw new Error('Invalid Cognito token');
  }
};

/**
 * Admin login with username/password (for SUPER_ADMIN and RESTAURANT_ADMIN)
 */
export const adminLogin = async (username, password) => {
  try {
    const command = new AdminInitiateAuthCommand({
      UserPoolId: COGNITO_USER_POOL_ID,
      ClientId: COGNITO_APP_CLIENT_ID,
      AuthFlow: 'ADMIN_NO_SRP_AUTH',
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password
      }
    });

    const response = await cognitoClient.send(command);
    
    return {
      accessToken: response.AuthenticationResult.AccessToken,
      idToken: response.AuthenticationResult.IdToken,
      refreshToken: response.AuthenticationResult.RefreshToken,
      expiresIn: response.AuthenticationResult.ExpiresIn
    };
  } catch (error) {
    console.error('Admin login error:', error);
    throw new Error('Invalid credentials');
  }
};

/**
 * Initiate custom auth flow for phone OTP (for staff)
 */
export const initiatePhoneAuth = async (phoneNumber) => {
  try {
    const command = new AdminInitiateAuthCommand({
      UserPoolId: COGNITO_USER_POOL_ID,
      ClientId: COGNITO_APP_CLIENT_ID,
      AuthFlow: 'CUSTOM_AUTH',
      AuthParameters: {
        USERNAME: phoneNumber
      }
    });

    const response = await cognitoClient.send(command);
    
    return {
      session: response.Session,
      challengeName: response.ChallengeName
    };
  } catch (error) {
    console.error('Initiate phone auth error:', error);
    throw new Error('Failed to send OTP');
  }
};

/**
 * Respond to custom auth challenge with OTP
 */
export const respondToAuthChallenge = async (phoneNumber, otp, session) => {
  try {
    const command = new RespondToAuthChallengeCommand({
      ClientId: COGNITO_APP_CLIENT_ID,
      ChallengeName: 'CUSTOM_CHALLENGE',
      Session: session,
      ChallengeResponses: {
        ANSWER: otp,
        USERNAME: phoneNumber
      }
    });

    const response = await cognitoClient.send(command);
    
    if (response.AuthenticationResult) {
      return {
        accessToken: response.AuthenticationResult.AccessToken,
        idToken: response.AuthenticationResult.IdToken,
        refreshToken: response.AuthenticationResult.RefreshToken,
        expiresIn: response.AuthenticationResult.ExpiresIn
      };
    }
    
    throw new Error('Invalid OTP');
  } catch (error) {
    console.error('Respond to auth challenge error:', error);
    throw new Error('Invalid OTP');
  }
};

/**
 * Create a new Cognito user (called when creating staff/admin)
 */
export const createCognitoUser = async ({ 
  username, 
  name,
  phone, 
  role, 
  staffId, 
  branchId = null, 
  restaurantId = null,
  temporaryPassword = null,
  password = null,
  email = null 
}) => {
  try {
    const userAttributes = [
      { Name: 'custom:role', Value: role },
      { Name: 'custom:staffId', Value: staffId }
    ];

    // Add name if provided
    if (name) {
      userAttributes.push({ Name: 'name', Value: name });
    }

    // Add email if provided (for password reset)
    // If username is email format, use it as email attribute
    const emailToUse = email || (username && username.includes('@') ? username : null);
    if (emailToUse) {
      userAttributes.push({ Name: 'email', Value: emailToUse });
      userAttributes.push({ Name: 'email_verified', Value: 'true' });
    }

    // Add phone for staff with phone OTP
    if (phone) {
      userAttributes.push({ Name: 'phone_number', Value: phone });
      userAttributes.push({ Name: 'phone_number_verified', Value: 'true' });
    }

    // Add branch/restaurant context if available
    if (branchId) {
      userAttributes.push({ Name: 'custom:branchId', Value: branchId });
    }
    if (restaurantId) {
      userAttributes.push({ Name: 'custom:restaurantId', Value: restaurantId });
    }

    // Determine Cognito username:
    // - If username exists (SUPER_ADMIN, RESTAURANT_ADMIN), use it as Cognito username
    // - If only phone (CAPTAIN, KITCHEN), use staffId (phone will be alias for login)
    const usernameForCognito = username || staffId;
    const createCommand = new AdminCreateUserCommand({
      UserPoolId: COGNITO_USER_POOL_ID,
      Username: usernameForCognito,
      UserAttributes: userAttributes,
      TemporaryPassword: temporaryPassword || password,
      MessageAction: 'SUPPRESS', // Don't send welcome messages
      DesiredDeliveryMediums: []
    });

    await cognitoClient.send(createCommand);

    // Set permanent password if provided
    if (password) {
      const setPasswordCommand = new AdminSetUserPasswordCommand({
        UserPoolId: COGNITO_USER_POOL_ID,
        Username: usernameForCognito,
        Password: password,
        Permanent: true
      });
      await cognitoClient.send(setPasswordCommand);
    } else if (phone) {
      // For phone users without password, set a random permanent password (they'll use OTP anyway)
      const permanentPassword = Math.random().toString(36).slice(-16) + 'A1!';
      const setPasswordCommand = new AdminSetUserPasswordCommand({
        UserPoolId: COGNITO_USER_POOL_ID,
        Username: usernameForCognito,
        Password: permanentPassword,
        Permanent: true
      });
      await cognitoClient.send(setPasswordCommand);
    }

    // VERIFICATION STEP: Confirm user was actually created by retrieving it
    const verifyCommand = new AdminGetUserCommand({
      UserPoolId: COGNITO_USER_POOL_ID,
      Username: usernameForCognito
    });
    
    try {
      const verifyResponse = await cognitoClient.send(verifyCommand);
      if (!verifyResponse || !verifyResponse.Username) {
        throw new Error('User verification failed - user not found in pool after creation');
      }
      console.log(`✓ Cognito user created and verified: ${usernameForCognito}`);
    } catch (verifyError) {
      console.error('User verification failed:', verifyError);
      throw new Error(`User created but verification failed: ${verifyError.message}`);
    }

    return { success: true, username: usernameForCognito };
  } catch (error) {
    console.error('Create Cognito user error:', error);
    throw new Error(`Failed to create Cognito user: ${error.message}`);
  }
};

/**
 * Update user custom attributes (when staff details change)
 */
export const updateCognitoUserAttributes = async (username, attributes) => {
  try {
    const userAttributes = Object.entries(attributes).map(([key, value]) => ({
      Name: key.startsWith('custom:') ? key : `custom:${key}`,
      Value: String(value)
    }));

    const command = new AdminUpdateUserAttributesCommand({
      UserPoolId: COGNITO_USER_POOL_ID,
      Username: username,
      UserAttributes: userAttributes
    });

    await cognitoClient.send(command);
    return { success: true };
  } catch (error) {
    console.error('Update Cognito user attributes error:', error);
    throw new Error('Failed to update user attributes');
  }
};

/**
 * Get Cognito user details
 */
export const getCognitoUser = async (username) => {
  try {
    const command = new AdminGetUserCommand({
      UserPoolId: COGNITO_USER_POOL_ID,
      Username: username
    });

    const response = await cognitoClient.send(command);
    return response;
  } catch (error) {
    console.error('Get Cognito user error:', error);
    return null;
  }
};
