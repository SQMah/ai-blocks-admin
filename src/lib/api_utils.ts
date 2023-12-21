import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "@auth0/nextjs-auth0";
import { stringToBoolean, zodErrorMessage } from "./utils";
import { string, z } from "zod";
import { AxiosError } from "axios";
import { Prisma } from "@prisma/client";
import { getUserByEmail } from "./drizzle_functions";

const requireAdminCheck = stringToBoolean(process.env.REQUIRE_ADMIN) ?? true;

export const adminCheck = async (
  req: NextApiRequest,
  res: NextApiResponse<any>
): Promise<boolean> => {
  if (!requireAdminCheck) return true;
  try {
    const session = await getSession(req, res);
    console.log(session);
    if (!session?.user?.eamil) {
      throw new APIError("Unauthorized");
    }
    const email = session.user.email as string;
    try {
      const user = await getUserByEmail(email);
      if (user.role !== "admin") {
        throw new APIError("Forbidden");
      }
    } catch (error) {
      if (error instanceof APIError && error.status === "Resource Not Found") {
        throw new APIError("Unauthorized");
      }
      throw error;
    }
    return true;
  } catch (error: any) {
    const handler = new ServerErrorHandler(error);
    handler.log();
    handler.sendResponse(req, res);
    return false;
  }
};

const APIErrorStatus = {
  "Bad Request": 400,
  "Invalid Request Body": 400,
  "Invalid Request Params": 400,
  Unauthorized: 401,
  Forbidden: 403,
  "Resource Not Found": 404,
  "Not Found": 404,
  Conflict: 409,
  "Auth0 Error": 500,
  "DB Error": 500,
  "Mailing Error": 500,
  "Cloud Watch Error": 500,
  "Implementation Error": 500,
  "Internal Server Error": 500,
} as const;

type API_ERROR_STATUS = typeof APIErrorStatus;

export type ERROR_STATUS_TEXT = keyof API_ERROR_STATUS;

type ERROR_STATUS_CODE = API_ERROR_STATUS[ERROR_STATUS_TEXT];

const APISuccessStatus = {
  OK: 200,
  Created: 201,
  "No Content": 204,
} as const;

type API_SUCCESS_STATUS = typeof APISuccessStatus;

export type SUCCESS_STATUS_TEXT = keyof API_SUCCESS_STATUS;
export type SUCCESS_STATUS_CODE = API_SUCCESS_STATUS[SUCCESS_STATUS_TEXT];

export class APIError extends Error {
  public readonly code: ERROR_STATUS_CODE;
  public readonly status: ERROR_STATUS_TEXT;
  public readonly name: string;
  constructor(
    status: ERROR_STATUS_TEXT,
    message: string | undefined = undefined
  ) {
    message = message ?? status;
    super(message);
    this.name = "APIError";
    this.status = status;
    this.code = APIErrorStatus[status];
  }
}

export class ServerErrorHandler {
  public readonly message: string;
  public readonly status_text: ERROR_STATUS_TEXT;
  public readonly status_code: number;
  constructor(error: any) {
    // console.log('error catch',error)
    if (error instanceof APIError) {
      this.status_code = error.code;
      this.status_text = error.status;
      this.message = error.message;
    } else if (error instanceof z.ZodError) {
      this.status_code = 400;
      this.status_text = "Bad Request";
      this.message = zodErrorMessage(error.issues);
    } else if (error instanceof AxiosError) {
      this.status_code = 500;
      this.status_text = "Auth0 Error";
      this.message = error.response?.data?.message ?? "Unknown";
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      this.status_code = 500;
      this.status_text = "DB Error";
      this.message = error.message ?? "Unknown";
    } else {
      this.status_code = 500;
      this.status_text = "Internal Server Error";
      if (error instanceof Error) this.message = error.message ?? "Unknown";
      else this.message = "Unknown";
    }
  }
  log() {
    console.error(`Logging Error Message: ${this.status_text}->${this.message}`);
  }
  sendResponse(req: NextApiRequest, res: NextApiResponse) {
    res.status(this.status_code).json({
      status: this.status_code,
      // message: `${this.status_text}: ${this.message}`,
      message:this.message,
      details: {
        resource: req.url,
        method: req.method,
      },
    });
  }
}


