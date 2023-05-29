import type { NextApiRequest, NextApiResponse } from 'next'
import { createUser,getAccessToken,checkRole,searchUser,SearchResoponse} from '@/lib/auth0_user_management'
import { UserResponseData,UserWithRole } from '@/models/auth0_interfaces'
import { getSession } from '@auth0/nextjs-auth0';
import z from "zod"
import { userCraeteType } from '@/models/user';


export type reqBody = {
  users:userCraeteType[]
}



const handler = async (req: NextApiRequest,res: NextApiResponse<SearchResoponse|UserResponseData[]|string>) => {
  if(req.method=="GET"){
    try {
      let { studentId } = req.query;
      if(studentId == undefined){
        res.status(500).send("Student ID is required")
        return
      }else if(Array.isArray(studentId)){
        studentId = studentId[studentId.length-1]
      }
      const token = await getAccessToken()
      const users:SearchResoponse = await searchUser(token,studentId)
      //console.log(users)
      res.status(200).json(users)
      return 
    } catch (error:any) {
      res.status(500).send(error.message)
      return
    }
  }
  else if(req.method=="POST"){
      try {
        // console.log(req.body)
        const session:any = await getSession(req,res)
        // console.log(session)
        if (!session?.user?.sub) {
          return res.status(401).json('Unauthorized')
        }
        const token: string = await getAccessToken();
        const userId = session.user.sub
        const roles: string[] = await checkRole(token, userId);
        if (!roles.includes('admin')) {
          return res.status(403).send('Forbidden')
        }
        const body: reqBody = req.body;
        const {users} = body
        let responseData:UserResponseData[]=[]
        for(let user of users){
          try {
            const { email, first_name, last_name, role,classId ,expiration  } = user;
            const data: UserResponseData = await createUser(token,role, email, first_name, last_name, classId,expiration);
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