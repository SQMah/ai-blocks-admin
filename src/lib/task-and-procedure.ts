import {
  Data,
  Proccessed,
  Action,
  DataHandler,
  TaskHandler,
  Auth0Action,
  TRY_LIMIT,
  wait,
  Auth0_Data,
  DB_Data,
  EmailParam,
} from "./task-handler";
import {
  ERROR_STATUS_TEXT,
  APIError,
} from "./api_utils";
import {
  getAccessToken,
 createAuth0Account,
 deleteAuth0Account,
 getInvitationPramas,
} from "./auth0_user_management";
import { futureDate, type TupleSplit } from "./utils";
import { User } from "@/models/db_schemas";
import { Auth0User } from "@/models/auth0_schemas";
import { batchCreateUsers, createUser, deleteManyUser, deleteUser, findManyUsers } from "./db";
import { sendMail } from "./mail_sender";

const defaultDateParam = [0,1,0] as const  //days, months, years + tdy

const [defaultDays,defaultMonths,defaultYears] = defaultDateParam

class CheckFn<F extends (...args: any) => TaskHandler> {
  private fn: F;
  private args: Parameters<F>;
  constructor(fn: F, args: Parameters<F>) {
    this.fn = fn;
    this.args = args;
  }
  check(instance: TaskHandler) {
    this.fn.apply(instance, this.args);
    return instance;
  }
}

export abstract class Procedure<A extends Action<Data>> {
  public name: string;
  public action: A;
  public stoppingCondition: ERROR_STATUS_TEXT[];
  abstract payload: TupleSplit<Parameters<A>, 1>[1] | Parameters<A>;
  abstract process: (instance: TaskHandler) => Promise<Proccessed<A>>;
  constructor(
    name: string,
    action: A,
    stoppingCondition: ERROR_STATUS_TEXT[] = []
  ) {
    this.name = name;
    this.action = action;
    this.stoppingCondition = stoppingCondition;
  }
}

export class GetAuthTokenProcedure extends Procedure<typeof getAccessToken> {
  payload: Parameters<typeof getAccessToken> = [];
  constructor() {
    super("Get Auth0 Access Token", getAccessToken);
  }
  process = async (instance: TaskHandler) => {
    console.log(`Processing ${this.name}.`);
    for (let tried = 1; tried <= TRY_LIMIT; ++tried) {
      try {
        const data = await this.action.apply(instance, this.payload);
        //return if no error
        console.log(`${this.name} done.`);
        return data as string;
      } catch (error: any) {
        console.log(
          `${this.name} failed at trial ${tried}, message:${
            error.message ?? "Unknown"
          }`
        );
        if (tried >= TRY_LIMIT) {
          throw error;
        }
        //hit the stopping condition (e.g. user not found) => DO NOT try agn
        if (
          error instanceof APIError &&
          this.stoppingCondition.includes(error.status)
        ) {
          throw error;
        }
      }
      await wait();
    }
    throw new APIError("Internal Server Error", "Try Limit Exceeded");
  };
}

export class Auth0Procedure<A extends Auth0Action<Auth0_Data>> extends Procedure<A> {
  payload: TupleSplit<Parameters<A>, 1>[1];
  process = async (instance: TaskHandler) => {
    console.log(`Procesing ${this.name}.`);
    const token = instance.getAuth0Token();
    for (let tried = 1; tried <= TRY_LIMIT; ++tried) {
      try {
        const data = await this.action.apply(instance, [
          token,
          ...[...this.payload],
        ]);
        //return if no error
        console.log(`${this.name} done.`);
        return data as Proccessed<A>;
      } catch (error: any) {
        console.log(
          `${this.name} failed at trial ${tried}, message:${
            error.message ?? "Unknown"
          }`
        );
        if (tried >= TRY_LIMIT) {
          throw error;
        }
        //hit the stopping condition (e.g. user not found) => DO NOT try agn
        if (
          error instanceof APIError &&
          this.stoppingCondition.includes(error.status)
        ) {
          throw error;
        }
      }

      await wait();
    }
    throw new APIError("Internal Server Error", "Try Limit Exceeded");
  };
  constructor(
    name: string,
    action: A,
    payload: TupleSplit<Parameters<A>, 1>[1],
    stoppingCondition: ERROR_STATUS_TEXT[] = []
  ) {
    super(name, action, stoppingCondition);
    this.payload = payload;
  }
}

export class DBProcedure<A extends Action<DB_Data>> extends Procedure<A> {
  payload: Parameters<A>;
  process = async (instance: TaskHandler) => {
    console.log(`Procesing ${this.name}.`);
    for (let tried = 1; tried <= TRY_LIMIT; ++tried) {
      try {
        const data = await this.action.apply(instance, this.payload);
        //return if no error
        console.log(`${this.name} done.`);
        return data as Proccessed<A>;
      } catch (error: any) {
        `${this.name} failed at trial ${tried}, message:${
          error.message ?? "Unknown"
        }`
        if (tried >= TRY_LIMIT) {
          throw error;
        }
        //hit the stopping condition (e.g. user not found) => DO NOT try agn
        if (
          error instanceof APIError &&
          this.stoppingCondition.includes(error.status)
        ) {
          throw error;
        }
      }
      await wait();
    }
    throw new APIError("Internal Server Error", "Try Limit Exceeded");
  };
  constructor(
    name: string,
    action: A,
    payload: Parameters<A>,
    stoppingCondition: ERROR_STATUS_TEXT[] = []
  ) {
    super(name, action, stoppingCondition);
    this.payload = payload;
  }
}


export abstract class Task<D extends Data> {
  //check before foward proccess and data handle
  readonly preCheck: CheckFn<any>[] = []; //chaining of check fn
  //actual => call enqueue
  //how to handle data
  dataHandler: DataHandler<any> = () => {};
  //take enque data and add a revert action to stack
  createRevert: (data: D) => Procedure<Action<any>>[] =
  () => [];
  //direct procedure to add
  readonly revertProcedures: Procedure<Action<Data>>[] = [];
  //check after data handle and forward process
  readonly postCheck: CheckFn<any>[] = [];
  //additional action after handle data
  // enqueue: DataHandler<D> = (data: D) => {};
  //task to enqueue that depends on data returned
  createEnqueue: (data: D) =>  Task<any>[] = () => [];
  
  abstract forward: Procedure<Action<D>>;
  abstract run: (instance: TaskHandler) => Promise<void>;
}


export abstract class  Auth0Task<D extends Auth0_Data> extends Task<D>{
  abstract forward: Procedure<Action<D>>;
  run = async (instance: TaskHandler)=>{
      //pre check
      ///task = new Task(data)
      try {
        //check is passed if no error thrown
        this.preCheck.forEach((fn) => {
          fn.check(instance);
        });
      } catch (error) {
        //stop the task if checking is not passed
        instance.handleError("Preprocess Checking", error);
        return;
      }
      try {
        const data = await this.forward.process(instance);
        //add revert directly
        //two procedure fix later
        instance.addRevert(...this.revertProcedures);
        //create and add revert
        try {
          const procedure = this.createRevert.apply(this, [data]);
          instance.addRevert(...procedure);
        } catch (error) {
          instance.handleError("Create Revert Procedure", error);
          return;
        }
        //handle data
        try {
          this.dataHandler.apply(instance, [data]);
        } catch (error) {
          instance.handleError("Handle Data", error);
          return;
        }
        //post check
        try {
          this.postCheck.forEach((fn) => {
            fn.check(instance);
          });
        } catch (error) {
          //stop the task if checking is not passed
          instance.handleError("Postprocess Checking", error);
          return;
        }
        //create enqueue
        try {
          const tasks = this.createEnqueue.apply(this, [data]);
          // console.log(tasks)
          instance.addAuth0Tasks(...tasks);
          // console.log(instance.task_queue.length)
        } catch (error) {
          instance.handleError("Create Enqueue", error);
          return;
        }
      } catch (error) {
        //the only uncatch error is error from forward process
        instance.handleError(this.forward.name, error);
      }
      return;
    }
}

export abstract class  DBTask<D extends DB_Data> extends Task<D>{
  abstract forward: Procedure<Action<D>>;
  run = async (instance: TaskHandler)=>{
      //pre check
      ///task = new Task(data)
      try {
        //check is passed if no error thrown
        this.preCheck.forEach((fn) => {
          fn.check(instance);
        });
      } catch (error) {
        //stop the task if checking is not passed
        instance.handleError("Preprocess Checking", error);
        return;
      }
      try {
        const data = await this.forward.process(instance);
        //add revert directly
        //two procedure fix later
        instance.addRevert(...this.revertProcedures);
        //create and add revert
        try {
          const procedure = this.createRevert.apply(this, [data]);
          instance.addRevert(...procedure);
        } catch (error) {
          instance.handleError("Create Revert Procedure", error);
          return;
        }
        //handle data
        try {
          this.dataHandler.apply(instance, [data]);
        } catch (error) {
          instance.handleError("Handle Data", error);
          return;
        }
        //post check
        try {
          this.postCheck.forEach((fn) => {
            fn.check(instance);
          });
        } catch (error) {
          //stop the task if checking is not passed
          instance.handleError("Postprocess Checking", error);
          return;
        }
        //create enqueue
        try {
          const tasks = this.createEnqueue.apply(this, [data]);
          // console.log(tasks)
          instance.addDBTasks(...tasks);
          // console.log(instance.task_queue.length)
        } catch (error) {
          instance.handleError("Create Enqueue", error);
          return;
        }
      } catch (error) {
        //the only uncatch error is error from forward process
        instance.handleError(this.forward.name, error);
      }
      return;
    }
}

export class CreateAuth0AccountTask extends Auth0Task<Auth0User>{

  forward:Auth0Procedure<Action<Auth0User>>

  constructor(instance:TaskHandler,email:string){
    super()
    this.forward = new Auth0Procedure(`Create Auth0 A/C for ${email}`,createAuth0Account,[email],["Conflict"])
    this.createRevert = (data)=>{
      const revert = new Auth0Procedure(`Revert Create Auth0 A/C for ${email}`,deleteAuth0Account,[data.email])
      return [revert]
    }
  }
}

export class createSignleUserTask extends DBTask<User>{
  forward:DBProcedure<Action<User>>

  constructor(instance:TaskHandler,payload:Parameters<typeof createUser>[0]){
    super()
    this.forward = new DBProcedure(`Create ${payload.role} data for ${payload.email}`,createUser,[payload],["Conflict"])
    this.dataHandler = instance.handleUserData
    this.createRevert = ()=> [new DBProcedure(`Revert Create ${payload.role} data for ${payload.email}`,deleteUser,[payload.email])]
  }
}

export class GetInvitationParamsTask extends Auth0Task<EmailParam>{
  forward: Procedure<Action<EmailParam>>;

  constructor(instance:TaskHandler,email:string,name:string){
    super()
    this.forward = new Auth0Procedure(`Get Invitation Ticket for ${email}`, getInvitationPramas,[email,name])
    this.dataHandler = instance.handleEmailParam
  }
}

export class DeleteUserTask extends DBTask<User>{
  forward:DBProcedure<Action<User>>
  constructor(instance:TaskHandler,email:string){
    super()
    this.forward = new DBProcedure(`Delete User email:${email}`,deleteUser,[email],["Resource Not Found"])
    this.dataHandler = instance.handleUserData
    this.createRevert = (user)=>{
      const {enrolled,managing,families,role,...data} = user
      let payload:Parameters<typeof createUser>[0] 
      const defaultDate = futureDate(defaultDays,defaultMonths,defaultYears).toJSDate()
      if(role ==="admin"){
        payload ={
          ...data,
          role:"admin",
          expiration_date:null,
          available_modules:null
        }
      }else if(role ==="student" ){
        payload ={
          role,
          ...data,
          expiration_date:data.expiration_date??defaultDate,
          enrolled:enrolled,
          families:families
        }
      }else if(role ==="parent" || role === "teacher"){
        payload ={
          role,
          ...data,
          expiration_date:data.expiration_date??defaultDate,
          managing:managing,
          available_modules:null
        }
      }else{
        payload ={
          role:"student",
          ...data,
          expiration_date:data.expiration_date??defaultDate,
          families:[]
        }
      }
      return [new DBProcedure(`Revert Delete User for ${email}`,createUser,[payload])]
    }
  }
}

export class DeleteAuth0AccountTask extends Auth0Task<undefined>{
  forward: Procedure<Action<undefined>>;
  constructor(instance:TaskHandler,email:string){
    super()
    this.forward = new Auth0Procedure(`Delete Auth0 Account for ${email}`,deleteAuth0Account,[email],["Resource Not Found"])
    const sendInvitation =async (access_token:string,email:string) => {
        const {url} = await getInvitationPramas(access_token,email,email)
        await sendMail(email,email,url)
        console.log(`Recover email sent to ${email}`)
    }
    this.createRevert = ()=> [ new Auth0Procedure(`Ask For Change Password for ${email}`,sendInvitation,[email]), new Auth0Procedure(`Revert Delete Auth0 A/C ${email}`,createAuth0Account,[email])]
  }
}

export class BatchCreateUserTask extends DBTask<User[]>{
  forward:Procedure<Action<User[]>>

  constructor(instance:TaskHandler,payload:Parameters<typeof batchCreateUsers>[0]){
    super()
    this.forward = new DBProcedure(`Batch Create Users, count:${payload.users.length}`,batchCreateUsers,[payload])
    this.dataHandler = instance.handleUserData
    this.createRevert = (data)=>{
      const emails = data.map(user=>user.email)
      return [new DBProcedure(`revert Batch Create Users, count:${emails.length}`,deleteManyUser,[emails])]
    }
  }
}
