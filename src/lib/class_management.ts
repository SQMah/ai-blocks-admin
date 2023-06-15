import { PutCommand,GetCommand ,UpdateCommand,DeleteCommand} from "@aws-sdk/lib-dynamodb";
import { ddbDocClient } from "@/lib/ddbDocClient";

import {  PostClassesReqType, PutClassesReqSchema, PutClassesReqType } from "@/models/api_schemas";
import { classSchema } from "@/models/dynamoDB_schemas";

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
    if(!data.Item) return undefined
    return classSchema.parse(data.Item);
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
          teacherIds:new Set(teacherIds),
          capacity,
          available_modules:new Set(available_modules),
        },
      };
    const data = await ddbDocClient.send(new PutCommand(params));
    // console.log("Success - item added or updated", data);
    return data;
  } catch (err) {
    console.log("Error", err);
    throw new Error("Dynamo DB Error")
  }
};



export const updateClass = async (payload:PutClassesReqType) => {
  try {
    const {class_id,teacherIds,studentIds,capacity,available_modules,addStudents,addTeachers,removeStudents,removeTeachers} = PutClassesReqSchema.parse(payload)
    const exist = await getClass(class_id)
    if(!exist) throw new Error("Invalid class ID")
    const cur = classSchema.parse(exist)

    const studentSet = studentIds?new Set(studentIds):(cur.studentIds??new Set())
    const teacherSet = teacherIds?new Set(teacherIds):(cur.teacherIds??new Set())

    addStudents?.forEach(id=>{
      studentSet.add(id)
    })
    
    removeStudents?.forEach(id=>{
      studentSet.delete(id)
    })
    
    addTeachers?.forEach(id=>{
      teacherSet.add(id)
    })
    
    removeTeachers?.forEach(id=>{
      teacherSet.delete(id)
    })
    
    // console.log(studentSet,teacherSet)
    if((capacity??cur.capacity)<studentSet.size) throw new Error("Students number and cpacity mismatch")

    const modifyTeacher = Boolean(teacherIds||addTeachers||removeTeachers)
    const modifyStudent = Boolean(studentIds||addStudents||removeStudents)
    // console.log(modifyStudent,modifyTeacher)
    const expressionNames = {
      ...(modifyTeacher && { "#T": "teacherIds" }),
      ...(modifyStudent && { "#S": "studentIds" }),
      ...(capacity && { "#C": "capacity" }),
      ...(available_modules && { "#M": "available_modules" }),
    }
    const expressions = [
      modifyTeacher&&"#T = :t",
      modifyStudent&&"#S = :s",
      capacity&&"#C = :c",
      available_modules&&"#M = :m"
    ].filter(Boolean)
    const values = {
      ...(modifyTeacher && { ":t": teacherSet }),
      ...(modifyStudent && { ":s": studentSet }),
      ...(capacity && { ":c": capacity }),
      ...(available_modules && { ":m": new Set(available_modules) }),
    }
    // console.log(expressions,expressionNames,values)
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
    return classSchema.parse( data.Attributes);
  } catch (err) {
    console.log("Error", err);
    throw new Error("Dynamo DB Error")
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
    throw new Error("Dynamo DB Error")
  }
  

}