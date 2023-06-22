import type { NextApiRequest, NextApiResponse } from "next";
import {z} from "zod"
import {
  createUser,
  getAccessToken,
  checkRole,
  searchUser,
  sendInvitation,
  updateUser,
  deleteUser,
  getUserByID,
  deleteRole,
  assignRole,
} from "@/lib/auth0_user_management";

import { PostUsersReqSchema, PutUsersReqSchema } from "@/models/api_schemas";
import { delay ,removeDuplicates, zodErrorMessage} from "@/lib/utils";
import { APIError, adminCheck, serverHandleError } from "@/lib/api_utils";
import { updateClass } from "@/lib/class_management";
import { RoleArrayType, RoledUserType } from "@/models/auth0_schemas";


const handleGet = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    // console.log(req.query)
    let  { email,enrolled_class_id,teaching_class_ids,type} = req.query;
    if([email,enrolled_class_id,teaching_class_ids].every(query=>!query)){
      throw new APIError("Invalid Request Params","Please provide at least one search query.")
    }
    const inputs = [email,enrolled_class_id,teaching_class_ids]
    .map(input=>{
      if(input===undefined) return undefined
      if(!Array.isArray(input)) return [input]
      return removeDuplicates(input)
    })
    const emailParsing = z.array(z.string().email()).optional().safeParse(inputs[0])
    if(!emailParsing.success){
      throw new APIError("Invalid Request Params",zodErrorMessage(emailParsing.error.issues))
    }
    const  query = {
      email:emailParsing.data,
      enrolled_class_id:inputs[1],
      teaching_class_ids:inputs[2],
    }
    const searchType = type==="AND"||type==="OR"?type:undefined
    // console.log(query,searchType)
    const token = await getAccessToken();
    const users = await searchUser(token, query,searchType);
    res.status(200).json(users);
    return;
  } catch (error: any) {
    serverHandleError(error,req,res)
  }
};

const handlePost = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    const parsing = PostUsersReqSchema.safeParse(req.body)
    if(!parsing.success){
      throw new APIError("Invalid Request Body",zodErrorMessage(parsing.error.issues))
    }
    const payload = parsing.data
    //update classes
    if(payload.role==="managedStudent"){
      if(!payload.enrolled_class_id) throw new APIError("Invalid Request Body","Class ID is required for managed student.")
      await updateClass({
        class_id:payload.enrolled_class_id,
        addStudents:[payload.email]
      })
    }else if(payload.role==="teacher"&&payload.teaching_class_ids?.length){
      for(const class_id of payload.teaching_class_ids){
        await updateClass({
          class_id,
          addTeachers:[payload.email]
        })
      }
    }
    const token = await  getAccessToken()
    //craete user
    const user = await createUser(token,payload)
    //send inviation
    await sendInvitation(token,`${payload.first_name} ${payload.last_name}`,payload.email)
    res.status(201).json(user)
  } catch (error) {
    serverHandleError(error,req,res)
  }
};


const handleClassChange =async (token:string,user:RoledUserType,enrolled_class_id:string|undefined|null
  ,teaching_class_ids:string[]|undefined|null) => {
  if(enrolled_class_id===undefined&&teaching_class_ids===undefined) return
  const roles = user.roles
  if(roles.includes("teacher")&&teaching_class_ids!==undefined){
    const newClasses = teaching_class_ids??[]
    const oldClasses = user.user_metadata?.teaching_class_ids??[]
    //classes in updateds ids but not in present ids
    const toAdd = newClasses.filter(id=>!oldClasses.includes(id))
    //classes not in updated ids but in present ids
    const toRemove = oldClasses.filter(id=>!newClasses.includes(id))
    for(const class_id of toRemove){
      await updateClass({
        class_id,
        removeTeachers:[user.email]
      })
      await delay(300)
    }
    for(const class_id of toAdd){
      await updateClass({
        class_id,
        addTeachers:[user.email]
      })
      await delay(300)
    }
    //no need to reassign role
  }
  else if(roles.includes("managedStudent")&&enrolled_class_id!==undefined){
    if(enrolled_class_id){
      //change class
      const toRemove = user.user_metadata?.enrolled_class_id
      if(!toRemove) throw new APIError("Auth0 Error",`Enrolled class id undefined in managed student, email: ${user.email}`)
      //add to new class
      await updateClass({
        class_id:enrolled_class_id,
        addStudents:[user.email]
      })
      await delay(300)
      //remove from old class
      await updateClass({
        class_id:toRemove,
        removeStudents:[user.email]
      })
      //no need to reassign role
    }else{
      //become unmanaged
      const toRemove = user.user_metadata?.enrolled_class_id
      if(!toRemove) throw new APIError("Auth0 Error",`Enrolled class id undefined in managed student, email: ${user.email}`)
      await updateClass({
        class_id:toRemove,
        removeStudents:[user.email]
      })
      //reassign role 
      await deleteRole(token,user.user_id,"managedStudent")
      await assignRole(token,user.user_id,"unmanagedStudent")
    }
  }
  else if(roles.includes("unmanagedStudent")&&enrolled_class_id){
    //become managed student
    await updateClass({
      class_id:enrolled_class_id,
      addStudents:[user.email]
    })
    await deleteRole(token,user.user_id,"unmanagedStudent")
    await assignRole(token,user.user_id,"managedStudent")
  }
}

const handlePut = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    const parsing = PutUsersReqSchema.safeParse(req.body)
    if(!parsing.success){
      throw new APIError("Invalid Request Body",zodErrorMessage(parsing.error.issues))
    }
    const payload = parsing.data;
    const token = await getAccessToken();
    const user = await getUserByID(token,payload.userId)
    
    // console.log(payload)
    const roles = await checkRole(token, payload.userId);
    await handleClassChange(token,user,payload.content.enrolled_class_id,payload.content.teaching_class_ids)
    const data = await updateUser(token, payload, roles);
    // console.log(data)
    res.status(200).json(data);
    return;
  } catch (error: any) {
    serverHandleError(error,req,res)
  }
};

const handleDelete = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    let { userId } = req.query;
    if (userId == undefined||Array.isArray(userId)) {
      throw new APIError("Invalid Request Params","Please provide one and only one non-empty userId")
    }
    userId = userId.trim() 
    const token = await getAccessToken();
    const user = await getUserByID(token,userId)
    //update the classes
    if(user.roles.includes("teacher")){
      //handle teaching classes
      const toRemove = user.user_metadata?.teaching_class_ids??[]
      for (const class_id of toRemove){
        await updateClass({
          class_id,
          removeTeachers:[user.email]
        })
        await delay(300)
      }
    }
    if(user.roles.includes("managedStudent")){
      //handle enrolled class
      const class_id  = user.user_metadata?.enrolled_class_id
      if(!class_id) throw new APIError("Auth0 Error",`Enrolled class id undefined in managed student, email: ${user.email}`)
      await updateClass({
        class_id,
        removeStudents:[user.email]
      })
    }
    const data = await deleteUser(token, userId);
    console.log(`deleted user, user_id: ${userId}`);
    res.status(204).end();
    return;
  } catch (error: any) {
    serverHandleError(error,req,res)
  }
};

const handler = async (req: NextApiRequest,res: NextApiResponse) => {
  //configurate for authentication
  if(!await adminCheck(req,res)){
    return
  }
  const method: string | undefined = req.method;
  switch (method) {
    case "GET":
      await handleGet(req, res);
      break;
    case "POST":
      await handlePost(req, res);
      break;
    case "PUT":
      await handlePut(req, res);
      break;
    case "DELETE":
      await handleDelete(req, res);
      break;
    default:
      res.status(405).json({message:`${method} is not supported`});
      break;
  }
};

export default handler;
