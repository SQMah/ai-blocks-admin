import type { NextApiRequest, NextApiResponse } from 'next'
import { createUser,getAccessToken,checkRole,searchUser} from '@/lib/auth0_user_management'
import { getSession } from '@auth0/nextjs-auth0';
import {UserCreateType} from "@/models/api_schemas"
import {  RoledUserArrayType, UserCreateResponseArrayType, } from '@/models/auth0_schemas';

export type reqBody = {
  users:UserCreateType[]
}



const handler = async (req: NextApiRequest,res: NextApiResponse<RoledUserArrayType|UserCreateResponseArrayType|string>) => {
  if(req.method=="GET"){
    try {
      let { studentId } = req.query;
      if(studentId == undefined){
        res.status(500).send("Student ID is required")
        return
      }else if(Array.isArray(studentId)){
        studentId = studentId[studentId.length-1]
      }
      // console.log(studentId)
      const token = await getAccessToken()
      // console.log(token)
      const users = await searchUser(token,studentId)
      // console.log(users)
      res.status(200).json(users)
      return 
    } catch (error:any) {
      console.log(error.message||error)
      res.status(500).send(error.message||error)
      return
    }
  }
  else if(req.method=="POST"){
      try {
        // console.log(req.body)
        const session = await getSession(req,res)
        // console.log(session)
        if (!session?.user?.sub) {
          return res.status(401).json('Unauthorized')
        }
        const token = await getAccessToken();
        const userId = session.user.sub
        const roles = await checkRole(token, userId);
        if (!roles.includes('admin')) {
          return res.status(403).send('Forbidden')
        }
        const body: reqBody = req.body;
        const {users} = body
        let responseData:UserCreateResponseArrayType = []
        for(let user of users){
          try {
            const { email, first_name, last_name, role,classId ,expiration  } = user;
            const data = await createUser(token,role, email, first_name, last_name, classId,expiration);
            responseData = [...responseData,data]
          } catch (error:any) {
            continue
          }
        }
        res.status(201).json(responseData)
      } catch (error:any) {
        console.log(error)
        return res.status(500).send(error.message);
      }
  }
  
res.status(500)
}


export default handler