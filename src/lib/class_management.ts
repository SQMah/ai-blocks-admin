import { PutCommand,GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDocClient } from "@/lib/ddbDocClient";

import { PutClassesReqType } from "@/models/api_schemas";

const table_name = process.env.CLASS_TABLE_NAME
if(!table_name) throw new Error("Class table undefined")


export const getClass = async(class_id:string)=>{
    try {
    const  params = {
        TableName: table_name,
        Key: {
          class_id
        },
        };
    const data = await ddbDocClient.send(new GetCommand(params));
    // console.log("Success :", data);
    // console.log("Success :", data.Item);
    return data.Item;
    } catch (err) {
    console.log("Error", err);
    }

}

export const createClass = async (payload:PutClassesReqType) => {
  try {
    const {class_id,teacherIds,capacity,available_modules} = payload
    const params = {
        TableName: table_name,
        Item: {
          class_id,teacherIds,
          studentIds:[],
          capacity,available_modules,
        },
      };
    const data = await ddbDocClient.send(new PutCommand(params));
    // console.log("Success - item added or updated", data);
    return data;
  } catch (err) {
    console.log("Error", err);
    throw new Error("Dynamo DBError")
  }
};

