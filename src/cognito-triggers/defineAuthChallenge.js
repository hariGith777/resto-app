import { db } from "../common/db.js";

/**
 * Define Auth Challenge Lambda Trigger
 * Determines which challenge to present to the user
 */
export const handler = async (event) => {
  console.log('Define Auth Challenge Event:', JSON.stringify(event, null, 2));

  // First attempt - send custom challenge (OTP)
  if (event.request.session.length === 0) {
    event.response.challengeName = 'CUSTOM_CHALLENGE';
    event.response.issueTokens = false;
    event.response.failAuthentication = false;
  }
  // User answered the challenge
  else if (
    event.request.session.length === 1 &&
    event.request.session[0].challengeName === 'CUSTOM_CHALLENGE' &&
    event.request.session[0].challengeResult === true
  ) {
    // Correct answer - issue tokens
    event.response.issueTokens = true;
    event.response.failAuthentication = false;
  }
  // Wrong answer or too many attempts
  else {
    event.response.issueTokens = false;
    event.response.failAuthentication = true;
  }

  return event;
};
