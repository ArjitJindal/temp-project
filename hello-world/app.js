// const axios = require('axios')
// const url = 'http://checkip.amazonaws.com/';
let response;
const AWS = require("aws-sdk"),
  dynamoDb = new AWS.DynamoDB.DocumentClient();

/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Context doc: https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html
 * @param {Object} context
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 *
 */
exports.lambdaHandler = async (event, context) => {
  try {
    let key = { PartitionKeyID: "stuffs" };
    let params = {
      TableName: "Transactions",
      Item: {
        PartitionKeyID: "somewhatfamous3",
        SortKeyID: "thingsyouwontbelieve",
        userID: "innocentuserman",
      },
      ReturnConsumedCapacity: "TOTAL",
    };
    try {
      let putItemOutput = await dynamoDb.put(params).promise();
      console.log(`putItemOutput: ${JSON.stringify(putItemOutput)}`);
      response = {
        statusCode: 200,
        body: JSON.stringify({
          message: "success",
          updatedTransaction: putItemOutput.Attributes,
        }),
      };
    } catch (dbError) {
      let errorResponse = `Error: Execution update, caused a Dynamodb error, please look at your logs.`;
      if (dbError.code === "ValidationException") {
        if (dbError.message.includes("reserved keyword"))
          errorResponse = `Error: You're using AWS reserved keywords as attributes`;
      }
      console.log(dbError);
      // const ret = await axios(url);
      response = {
        statusCode: 500,
        body: JSON.stringify({
          error: dbError.message,
          // location: ret.data.trim()
        }),
      };
    }
  } catch (err) {
    console.log(err);
    return err;
  }

  return response;
};
