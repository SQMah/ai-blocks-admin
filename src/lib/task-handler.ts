import { APIError, ERROR_STATUS_TEXT, ServerErrorHandler } from "./api_utils";
import { delay } from "./utils";

import { Auth0Task, DBTask, DeleteAuth0AccountTask, GetAuthTokenProcedure, Procedure, Task, CreateAuth0AccountTask, createSignleUserTask, DeleteUserTask, GetInvitationParamsTask, BatchCreateUserTask, FindAndUpdateUserTask } from "./task-and-procedure";
import { putLogEvent } from "./cloud_watch";
import { Group, User } from "@/models/db_schemas";
import { Auth0User } from "@/models/auth0_schemas";
import { sendMail } from "./mail_sender";
import { PostBatchCreateUsersReq, PostUsersReq, PutUsersReq } from "@/models/api_schemas";

export const TRY_LIMIT = 3; //error hitting limit

const DEFAULT_WAITING_TIME = 300; //in ms

export function wait(time: number | undefined = undefined) {
  return delay(time ?? DEFAULT_WAITING_TIME);
}

//awaited return type of actions

export type Data =
  | User
  | User[]
  | Group
  | Group[]
  | string
  | Auth0User
  |EmailParam
  | void
  | undefined;

/**
 * fuction to call with payload
 */
export type Action<D extends Data> = (...args: any) => Promise<D>;

export type Auth0Action<D extends Data> = (
  access_token: string,
  ...args: any
) => Promise<D>;

export type Proccessed<A extends Action<Data>> = Awaited<ReturnType<A>>;

export type DataHandler<D extends Data> = (data: D[]|D) => void;

export type DB_Data =Exclude<Data,Auth0User|EmailParam>
export type Auth0_Data = Exclude<Data,User|Group>

export interface EmailParam {
  email: string;
  name: string;
  url: string;
}

export class TaskHandler {
  protected auth0_token: string | undefined;
  protected readonly auth0_tasks: Auth0Task<any>[] = [];
  protected readonly db_tasks: DBTask<any>[] = [];
  protected readonly revert_stack: Procedure<Action<Data>>[] = [];
  protected readonly emailsToSent: EmailParam[] = [];
  protected error_status_text: ERROR_STATUS_TEXT | undefined; //* undefined -> error occurs -> stop process and revert changes
  protected readonly error_messages: string[] = [];

  /**
   * email -> user data
   */
  protected users = new Map<string, User>();
  /**
   * class_id -> class data
   */
  protected groups = new Map<string, Group>();

  logic = {
    createSingleUser:(payload:PostUsersReq)=>{
      this
      .addDBTasks(new createSignleUserTask(this,payload))
      .addAuth0Tasks(new CreateAuth0AccountTask(this,payload.email,payload.name))
      .addAuth0Tasks(new GetInvitationParamsTask(this,payload.email,payload.name))
    },
    deleteUser:(email:string)=>{
      this.addAuth0Tasks(new DeleteAuth0AccountTask(this,email))
      .addDBTasks(new DeleteUserTask(this,email))
    },
    batchCreateUser:(payload:PostBatchCreateUsersReq)=>{
      //!for testing commend the auth0 tasks
      payload.users.forEach(user=>{
      const {email,name} = user
      this
      .addAuth0Tasks(new CreateAuth0AccountTask(this,email,name))
      .addAuth0Tasks(new GetInvitationParamsTask(this,email,name))
      })
      this.addDBTasks(new BatchCreateUserTask(this,payload))
    },
    updateUser:(payload:PutUsersReq)=>{
      const {email,...update} = payload
      this.addDBTasks(new FindAndUpdateUserTask(this,email,update))
    }
  };

  //utlis

  addAuth0Tasks(...tasks: Auth0Task<any>[]) {
    // console.log("tasks to add",task)
    this.auth0_tasks.splice(this.auth0_tasks.length, 0, ...tasks);
    // console.log(this.auth0_tasks);
    return this;
  }

  addDBTasks(...tasks: DBTask<any>[]) {
    // console.log("tasks to add",task)
    this.db_tasks.splice(this.db_tasks.length, 0, ...tasks);
    // console.log(this.db_tasks);
    return this;
  }

  addRevert(...procedures: Procedure<any>[]) {
    this.revert_stack.splice(this.revert_stack.length, 0, ...procedures);
    return this;
  }

  haveError() {
    return Boolean(this.error_status_text);
  }

  // setRequireAuht0Token() {
  //   this.require_token = true;
  //   return this.require_token;
  // }

  //handle data
  handleUserData(data: User[]|User) {
    if(!Array.isArray(data)){
      this.users.set(data.email,data)
      return
    }
    data.forEach((entry) => this.users.set(entry.email, entry));
  }


  handleClassData(data: Group[]|Group) {
    if(!Array.isArray(data)){
      this.groups.set(data.group_id,data)
      return
    }
    data.forEach((entry) => this.groups.set(entry.group_id, entry));
  }

  handleEmailParam(data:EmailParam|EmailParam[]){
    // console.log(data)
    const array = Array.isArray(data)?data:[data]
    this.emailsToSent.splice(this.emailsToSent.length,0,...array)
    // console.log(this.emailsToSent)
  }

  //checking fn s,throw error if check fail

  getAuth0Token() {
    const token = this.auth0_token;
    if (!token)
      throw new APIError("Internal Server Error", "Access Token is not set");
    return token;
  }

  //handler error when over try limit
  public handleError = (name: string, error: any) => {
    const handler = new ServerErrorHandler(error);
    //only keeping the first status
    if (!this.haveError()) {
      this.error_status_text = handler.status_text;
    }
    this.error_messages.push(`${name} Failed: ` + handler.message);
  };

  protected async postingRevertError(message: string) {
    putLogEvent("REVERT_ERROR", message);
  }

  //handle error when reverting error
  protected async handleRevertError(
    procedure: Procedure<Action<Data>>,
    error: any
  ) {
    const errorHandler = new ServerErrorHandler(error);
    const { status_text, status_code, message } = errorHandler;
    const cause = `Revert failed with status ${status_code}:${status_text}, message:${message}, failed procedure:${JSON.stringify(
      { ...procedure, action: procedure.action.name }
    )}.`;
    const remaining = this.revert_stack.map((procedure) => {
      return { ...procedure, action: procedure.action.name };
    });
    const toLog: string = [
      cause,
      `Remaining Revert Procedures: ${JSON.stringify(remaining)}`,
    ].join("\n");
    console.log(toLog);
    //log to cloud watch
    await this.postingRevertError(toLog);
  }

  //revert from the end of stack
  protected async revertChanges(): Promise<void> {
    const procedure = this.revert_stack.pop();
    if (!procedure) {
      //empty revert stack
      console.log("Revert complete.");
      return;
    }
    //revert the changaes as much as it can
    try {
      await procedure.process(this);
      await wait();
      return await this.revertChanges();
    } catch (error) {
      await this.handleRevertError(procedure, error);
    }
    return;
  }

  async processAuth0Tasks(): Promise<void> {
    if (this.haveError()) {
      return;
    }
    const task = this.auth0_tasks.shift(); //deque the first task from queue
    // console.log(task)
    if (!task) {
      //no task remain
      console.log("All Auth0 tasks completed.");
      //clear revert stack?
      //this.revert_stack = [];
      return;
    }
    await task.run(this);
    // console.log(this.task_queue,this.revert_stack)
    await wait();
    return await this.processAuth0Tasks();
  }

  async processDBTasks(): Promise<void> {
    if (this.haveError()) {
      return;
    }
    const task = this.db_tasks.shift(); //deque the first task from queue
    // console.log(task)
    if (!task) {
      //no task remain
      console.log("All DB tasks completed.");
      //clear revert stack?
      //this.revert_stack = [];
      return;
    }
    await task.run(this);
    // console.log(this.task_queue,this.revert_stack)
    // await wait();
    return await this.processDBTasks();
  }
  async proccessSendingEmails():Promise<void> {
    if (this.haveError()) {
      return;
    }
    const params = this.emailsToSent.shift(); //deque the first task from queue
    // console.log(task)
    if (!params) {
      console.log("All emails sent.");
      return;
    }
    const {email,name,url} = params
    try {
      await sendMail(name,email,url)
      // console.log(this.task_queue,this.revert_stack)
      console.log(`Invitation sent to ${email}`)
      // await wait();
    } catch (error) {
      this.handleError(`Sending Email to ${email}`,error)
    }
    return await this.proccessSendingEmails()
  }

  async run(): Promise<{
    users: Map<string, User>;
    groups: Map<string, Group>;
  }> {
    //get token first before continue to process tasks
    if (this.auth0_tasks.length && !this.auth0_token) {
      const procedure = new GetAuthTokenProcedure();
      try {
        this.auth0_token = await procedure.process(this);
      } catch (error) {
        //exceed try limit, failing checking or unexpected error
        this.handleError(procedure.name, error);
      }
    }

    //process auth0 and db tasks
    await Promise.allSettled([this.processAuth0Tasks(),this.processDBTasks()])

    //send the emails
    if(this.emailsToSent.length){
      await this.proccessSendingEmails()
    }
    //handle errors
    if (this.haveError()) {
      //revert the changes
      if (this.revert_stack.length) {
        console.log("Start reverting.");
        await this.revertChanges();
      }
      //handle by api
      throw new APIError(
        this.error_status_text as ERROR_STATUS_TEXT,
        this.error_messages.join(", ")
      );
    }
    console.log("All Tasks Completed")
    return { users: this.users, groups: this.groups };
  }
}

// const myHandler = new TaskHandler()
// myHandler.logic.class.batchGetClass()
// await myHandler.start()
// myHandler.getSingleClass()

//optimization: class_queue,user_queue,email_queue, first two can promise.all
//depenedce can be complicated
//but not really make that much difference cuz class operation are fast and usually batch action except update mutiple class
//sending email is the most time consuming but cannot asynchronously proceess wtih other queue becuz of depenence
//the final improvment maybe DEFAULT_WAITING_TIME * update actions on class DB
