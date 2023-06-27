import { APIError, serverErrorHandler } from "@/lib/api_utils";
import type { NextApiRequest,NextApiResponse } from "next";

const handler = (req:NextApiRequest,res:NextApiResponse) =>{
    try {
        throw new APIError("Resource Not Found","Please specify the route")
    } catch (error) {
        const errorHandler = new serverErrorHandler(error)
        errorHandler.sendResponse(req,res)
    }
}

export default handler