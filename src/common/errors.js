export const formatError = (err) => ({ message: err.message || "Unknown error" });

export const errorHandler = (fn) => async (event, context, helpers) => {
  try {
    return await fn(event, context, helpers);
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify(formatError(err)) };
  }
};
