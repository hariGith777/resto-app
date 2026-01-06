export const handler = async ({ body }, _, { db }) => {
  // For voice chat we would accept audio and return a transcript/response
  return { statusCode: 200, body: JSON.stringify({ message: "Voice chat endpoint (stub)" }) };
};
