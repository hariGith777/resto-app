module.exports = {
    formatResponse: (statusCode, body) => {
        return {
            statusCode,
            body: JSON.stringify(body),
        };
    },
    logEvent: (event) => {
        console.log("Event received:", JSON.stringify(event, null, 2));
    },
};