import { CloudWatchLogsClient} from "@aws-sdk/client-cloudwatch-logs"; // ES Modules import

// Set the AWS Region.
const REGION = process.env.AWS_REGION; //e.g. "us-east-1"
if(!REGION) throw new Error("Region for Cloud Watch is not defined")
const cwClient = new CloudWatchLogsClient({region:REGION});
export { cwClient };
