import {
  PutLogEventsCommand,
  CreateLogStreamCommand,
} from "@aws-sdk/client-cloudwatch-logs"; // ES Modules import
import { cwClient } from "./cwClient";
import { z } from "zod";
import { APIError } from "./api_utils";

const client = cwClient;

const group_name = process.env.CW_LOG_GROUP;

if (!group_name) {
  throw new Error("Cloud Watch Log Group Unset");
}
// if(! process.env.LOG_STREAMS||! process.env.LOG_STREAMS.length){
//     throw new Error("Cloud Watch Log Stream Names Unset")
// }

// const possible_streams = process.env.LOG_STREAMS.split(",")

const possible_streams = ["REVERT_ERROR","TEST_REVERT_ERROR"] as const;

type STREAM_NAME = (typeof possible_streams)[number];


export async function createLogStream(stream_name:string) {
    try {
        const input = { // CreateLogStreamRequest
          logGroupName: group_name, // required
          logStreamName:stream_name, // required
        };
        const command = new CreateLogStreamCommand(input);
        const response = await client.send(command);
    } catch (error:any) {
        throw new APIError("Cloud Watch Error",`Connection Error In Creating Stream, message:${error.message??"unknown"}`)
    }
}
// {};



export async function putLogEvent(stream_name: STREAM_NAME, message: string,tried_create_stream:boolean = false) {
  try {
    const input = {
      // PutLogEventsRequest
      logGroupName: group_name, // required
      logStreamName: stream_name, // required
      logEvents: [
        // InputLogEvents // required
        {
          // InputLogEvent
          timestamp: Date.now(), // required
          message: message, // required
        },
      ],
      sequenceToken: "STRING_VALUE",
    };
    const command = new PutLogEventsCommand(input);
    const response = await client.send(command);
    // console.log(response);
  } catch (error:any) {
    // console.log(error.message.includes("The specified log stream does not exist."))
    if(error.name === "ResourceNotFoundException"&&!tried_create_stream){
        const hasMessage = z.string().safeParse(error.message)
        if(hasMessage.success && hasMessage.data.includes("The specified log stream does not exist.")){
            //stream not exist
            await createLogStream(stream_name)
            await putLogEvent(stream_name,message,true)
            return
        }
    }
    throw new APIError("Cloud Watch Error",`Connection Error In Putting Log, message:${error.message??"unknown"}`)
  }
}
