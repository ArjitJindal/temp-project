import { DynamoDB } from 'aws-sdk'

export const unMarshallDynamoDBStream = (dataString: string) => {
  let data = dataString.replace('"B":', '"S":')
  const parserd_json = JSON.parse(data)
  return DynamoDB.Converter.unmarshall(parserd_json)
}
