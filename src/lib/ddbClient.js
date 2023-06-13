// Create service client module using ES6 syntax.
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
// Set the AWS Region.
const REGION = process.env.DYNAMODB_REGION; //e.g. "us-east-1"
if(!REGION) throw new Error("Region for DynamoDB is not defined")
// Create an Amazon DynamoDB service client object.
const ddbClient = new DynamoDBClient({ region: REGION });
export { ddbClient };