import { PutCommand,GetCommand ,UpdateCommand,DeleteCommand} from "@aws-sdk/lib-dynamodb";
import { ddbDocClient } from "@/lib/ddbDocClient";

import { GetClassResSchema, PostClassesReqType, PutClassesReqType } from "@/models/api_schemas";

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

export const createClass = async (payload:PostClassesReqType) => {
  try {
    const {class_id,teacherIds,capacity,available_modules} = payload
    const params = {
        TableName: table_name,
        Item: {
          class_id,
          teacherIds,
          studentIds:[],
          capacity,
          available_modules,
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



export const updateClass = async (payload:PutClassesReqType) => {
  try {
    const {class_id,teacherIds,studentIds,capacity,available_modules} = payload
    if(capacity&&studentIds){
      if(capacity<studentIds.length) throw new Error("Students number and cpacity mismatch")
    }
    else if(capacity||studentIds){
      const data = await getClass(class_id)
      if(!data) throw new Error("Invalid class ID")
      const cur = GetClassResSchema.parse(data)
      const condition = (capacity&&capacity<cur.studentIds.length)||(studentIds&&studentIds.length>cur.capacity)
      if(condition) throw new Error("Students number and cpacity mismatch")
    }
    const expressionNames = {
      ...(teacherIds && { "#T": "teacherIds" }),
      ...(studentIds && { "#S": "studentIds" }),
      ...(capacity && { "#C": "capacity" }),
      ...(available_modules && { "#M": "available_modules" }),
    }
    const expressions = [
      teacherIds&&"#T = :t",
      studentIds&&"#S = :s",
      capacity&&"#C = :c",
      available_modules&&"#M = :m"
    ].filter(Boolean)
    const values = {
      ...(teacherIds && { ":t": teacherIds }),
      ...(studentIds && { ":s": studentIds }),
      ...(capacity && { ":c": capacity }),
      ...(available_modules && { ":m": available_modules }),
    }
    if(expressions.length===0||Object.values(values).length===0||Object.values(expressionNames).length===0) throw new Error("Invalid update data")
    if(expressions.length!==Object.values(expressionNames).length) throw new Error("Name and expression mismatch")
    const params = {
      TableName: table_name,
      Key: {
        class_id,
      },
      // Define expressions for the new or updated attributes
      ExpressionAttributeNames:expressionNames,
      UpdateExpression: "set "+expressions.join(", "),
      ExpressionAttributeValues: values,
      ReturnValues: "ALL_NEW"
    };
    const data = await ddbDocClient.send(new UpdateCommand(params));
    // console.log("Success - item added or updated", data);
    return data.Attributes;
  } catch (err) {
    console.log("Error", err);
    throw new Error("Dynamo DBError")
  }
};


export const deleteClass = async (class_id:string) =>{
  const params = {
    TableName: table_name,
    Key: {
      class_id,
    },
  };
  try {
    const data = await ddbDocClient.send(new DeleteCommand(params));
    // console.log("Success - item deleted");
    return data;
  } catch (err) {
    console.log("Error", err);
    throw new Error("Dynamo DBError")
  }
  

}