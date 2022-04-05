import AWS from 'aws-sdk'

export function getTestDynamoDb(): AWS.DynamoDB.DocumentClient {
  return new AWS.DynamoDB.DocumentClient({
    credentials: undefined,
    endpoint: 'http://localhost:8000',
    region: 'us-east-2',
  })
}
