import { PutCommand,GetCommand ,UpdateCommand,DeleteCommand,ScanCommand} from "@aws-sdk/lib-dynamodb";
import { ddbDocClient } from "@/lib/ddbDocClient";

import {  PostClassesReqType,} from "@/models/api_schemas";
import { ClassType, classSchema ,ClassUpdatePaylod} from "@/models/dynamoDB_schemas";
import { z } from "zod";
import { APIError } from "./api_utils";
import { zodErrorMessage } from "./utils";
import { defaultModules } from "@/models/auth0_schemas";

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
    if(!data.Item) throw new APIError("Resource Not Found","Required class not found")
    return classSchema.parse(data.Item);
  } catch (error:any) {
    if(error instanceof APIError){
      throw error
    }else if(error instanceof z.ZodError){
      throw new APIError("Dynamo DB Error",zodErrorMessage(error.issues))
    }else{
      throw new APIError("Dynamo DB Error",`Connection Error In Getting Class, message:${error.message??"unknown"}`)
    }
  }
  

}

//class_id should be unipue
export const createClass = async (payload:PostClassesReqType,class_id:string) => {
  try {
    const {teacher_ids,capacity,available_modules,class_name} = payload
    const obj = {
      class_name,
      class_id,
      ...(teacher_ids.length&& {teacher_ids:new Set(teacher_ids)}),
      capacity,
      available_modules:new Set(available_modules??defaultModules)
    }
    const params = {
      TableName: table_name,
      Item: obj,
      ReturnValues:  "ALL_OLD",
    };
    const data = await ddbDocClient.send(new PutCommand(params));
    // console.log("Success - item added or updated", data);
    return classSchema.parse(obj);
  } catch (error:any) {
    if(error instanceof APIError){
      throw error
    }else if(error instanceof z.ZodError){
      throw new APIError("Dynamo DB Error",zodErrorMessage(error.issues))
    }else{
      throw new APIError("Dynamo DB Error",`Connection Error In Craeting Class, message:${error.message??"unknown"}`)
    }
  }

};



//checking class id validity, capacity
export  const classUpdatable =async (payload:ClassUpdatePaylod):Promise<ClassType> => {
  try {
    const {class_id,class_name,capacity,available_modules,addStudents,addTeachers,removeStudents,removeTeachers} = payload
    if(!(class_name||capacity||addStudents||addTeachers||removeStudents||removeTeachers||available_modules)) throw new APIError("Invalid Request Body","At least one update to be made.")
     //invalid class id will throw an API error
    const currentClass = await getClass(class_id)
    if(capacity||addStudents){
      const currentCapacity = capacity??currentClass.capacity
      const modifiedStudents = currentClass.student_ids??new Set()
      for(const id of addStudents??[]){
        modifiedStudents.add(id)
      }
      for(const id of removeStudents??[]){
        modifiedStudents.delete(id)
      }
      if(modifiedStudents.size > currentCapacity) throw new APIError("Conflict","Resulting number of students exceeds capacity.")
    }
    return currentClass
  } catch (error:any) {
    if(error instanceof APIError){
      throw error
    }else{
      throw new APIError("Dynamo DB Error",`Connection Error In Checking Class, message:${error.message??"unknown"}`)
    }
  }
}


//IMPORTANT:should call updatable before this function
//remove has higher priority than add
//adding and removing a student at the same time will perform no op
//since is set operaton, wont check for whether the user to add already in class and user to remove exist in class
export const updateClass = async (payload:ClassUpdatePaylod) => {
  try {
    const {class_id,class_name,capacity,available_modules,addStudents,addTeachers,removeStudents,removeTeachers} = payload
    if(!(class_name||capacity||addStudents||addTeachers||removeStudents||removeTeachers||available_modules)) throw new APIError("Invalid Request Body","At least one update to be made.")
    const names = new Map<string,string>()
    const values = new Map<string,string|number|Set<string>>([[":id",class_id]])
    const set = []
    const add = []
    const remove = []
    if(class_name){
      names.set("#N","class_name")
      values.set(":n",class_name)
      set.push("#N = :n")
    }
    if(capacity){
      names.set("#C","capacity")
      values.set(":c",capacity)
      set.push("#C = :c")
    }
    if(available_modules){
      names.set("#M","available_modules")
      values.set(":m",new Set(available_modules))
      set.push("#M = :m")
    }
    if(addStudents||removeStudents){
      names.set("#S","student_ids")
      if(addStudents){
        values.set(":as",new Set(addStudents))
        add.push("#S :as")
      }
      if(removeStudents){
        values.set(":rs",new Set(removeStudents))
        remove.push("#S :rs")
      }
    }
    if(addTeachers || removeTeachers){
      names.set("#T", "teacher_ids");
      if(addTeachers){
        values.set(":at", new Set(addTeachers));
        add.push("#T :at");
      }
      if(removeTeachers){
        values.set(":rt", new Set(removeTeachers));
        remove.push("#T :rt");
      }
    }
    const expressions:string[] = []
    if (set.length) {
      expressions.push(`SET ${set.join(", ")}`);
    }
    
    if (add.length) {
      expressions.push(`ADD ${add.join(", ")}`);
    }
    if (remove.length) {
      expressions.push(`DELETE ${remove.join(", ")}`);
    }
    // console.log(names,expressions.join(" "),values)
    const params = {
      TableName: table_name,
      Key: {
        class_id,
      },
      ExpressionAttributeNames:Object.fromEntries(names),
      UpdateExpression: expressions.join(" "),
      ExpressionAttributeValues: values,
      ConditionExpression: `class_id = :id`,
      ReturnValues: "ALL_NEW"
    };
    const data = await ddbDocClient.send(new UpdateCommand(params));
    // console.log("Success - item added or updated", data);
    return classSchema.parse( data.Attributes);
  } catch (error:any) {
    // console.log(error)
    if(error instanceof APIError){
      throw error
    }if(error.name == "ConditionalCheckFailedException"){
      //class id not exist
      throw new APIError("Resource Not Found","Invalid class ID")
    }else if(error instanceof z.ZodError){
      throw new APIError("Dynamo DB Error",zodErrorMessage(error.issues))
    }else{
      throw new APIError("Dynamo DB Error",`Connection Error In Craeting Class, message:${error.message??"unknown"}`)
    }
  };
}

export const deleteClass = async (class_id:string) =>{
  const params = {
    TableName: table_name,
    Key: {
      class_id,
    },
    ExpressionAttributeValues:{
      ":id":class_id
    },
    ConditionExpression: `class_id = :id`,
  };
  try {
    const data = await ddbDocClient.send(new DeleteCommand(params));
    // console.log("Success - item deleted");
    return undefined;
  } catch (error:any) {
    if(error.name == "ConditionalCheckFailedException"){
      //class id not exist
      throw new APIError("Resource Not Found","Invalid class ID")
    }else{
      throw new APIError("Dynamo DB Error",`Connection Error In Deleting Class, message:${error.message??"unknown"}`)
    }
  }
}

export const scanClass = async (classIds: string[])=>{
  if(classIds.length>100) throw new APIError("Invalid Request Params","Requesting too many items")
  try {
    classIds = classIds.filter(id=>id.length)
    const expressions:string[] = []
    const values = new Map()
    classIds.forEach((id,index)=>{
      const key = `:classId${index}`
      expressions.push(key)
      values.set(key,id)
    })
    // console.log(keys)
    const input = {
      TableName:table_name,
      FilterExpression: `class_id IN (${expressions.join(", ")})`,
      ExpressionAttributeValues: values
    }
    // console.log(input)
    const data = await ddbDocClient.send(new ScanCommand(input));
    // console.log("Success - item added or updated", data);
    return z.array(classSchema).parse(data.Items)
  } catch (error:any) {
    if(error.name === "ResourceNotFoundException" ){
      throw new APIError("Resource Not Found","Invalid class IDs")
    } else if(error instanceof z.ZodError){
      throw new APIError("Dynamo DB Error",zodErrorMessage(error.issues))
    }else{
      throw new APIError("Dynamo DB Error",`Connection Error In Scanning Class, message:${error.message??"unknown"}`)
    }
  }
}