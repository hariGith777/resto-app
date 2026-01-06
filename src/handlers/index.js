exports.handler = async (event) => {
    // Process the incoming event
    console.log("Received event:", JSON.stringify(event, null, 2));

    // Your logic here

    // Return a response
    return {
        statusCode: 200,
        body: JSON.stringify({
            message: "Success",
            input: event,
        }),
    };
};