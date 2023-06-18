import type { NextApiRequest, NextApiResponse } from "next";
import {
  getAccessToken,
  checkRole,
} from "@/lib/auth0_user_management";
import { getSession } from "@auth0/nextjs-auth0";
import { stringToBoolean,errorMessage } from "./utils";


const requireAdminCheck = stringToBoolean(process.env.REQUIRE_ADMIN)??true

export const adminCheck = async (req: NextApiRequest,res: NextApiResponse<any>): Promise<boolean> => {
    if(!requireAdminCheck) return true
    try {
      const session = await getSession(req, res);
      // console.log(session)
      if (!session?.user?.sub) {
        res.status(401).json({message:"Unauthorized"});
        return false
      }
      const token = await getAccessToken();
      const userId = session.user.sub as string;
      const roles = await checkRole(token, userId);
      if (!roles.includes("admin")) {
        res.status(403).json({message:"Forbidden"});
        return false
      }
      return true
    } catch (error:any) {
      res.status(500).json({message:errorMessage(error,true)});
      return false
    }
  };