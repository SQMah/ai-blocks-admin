import {
  RoledUserArraySchema,
  RoledUserSchema,
  RoledUserType,
  UserRoleType,
} from "@/models/auth0_schemas";
import { APIError, ERROR_STATUS_TEXT, ServerErrorHandler } from "./api_utils";
import {
  SerachQuery,
  assignRole,
  createUser,
  deleteRole,
  deleteUser,
  getAccessToken,
  getUserByEmail,
  searchUser,
  sendInvitation,
} from "./auth0_user_management";
import { ClassUpdatePaylod, classUpdatable, getClass, scanClass, updateClass } from "./class_management";
import {
  ClassType,
  classArraySchema,
  classSchema,
} from "@/models/dynamoDB_schemas";
import { delay } from "./utils";
import {
  BatchCreateUserReqType,
  PostUsersReqType,
  PutClassesReqType,
  PutUsersReqType,
  emailSchema,
} from "@/models/api_schemas";
import { ApiError } from "next/dist/server/api-utils";

const TRY_LIMIT = 3; //error hitting limit

const DEFAULT_WAITING_TIME = 500; //in ms

function wait(time: number | undefined = undefined) {
  return delay(time ?? DEFAULT_WAITING_TIME);
}

type TupleSplit<
  T,
  N extends number,
  O extends readonly any[] = readonly []
> = O["length"] extends N
  ? [O, T]
  : T extends readonly [infer F, ...infer R]
  ? TupleSplit<readonly [...R], N, readonly [...O, F]>
  : [O, T];

//awaited return type of actions
type Data =
  | RoledUserType
  | RoledUserType[]
  | ClassType
  | ClassType[]
  | string
  | void
  | undefined;
/**
 * fuction to call with payload
 */
type Action<D extends Data> = (...args: any) => Promise<D>;

type AuthAction<D extends Data> = (access_token:string,...args:any)=>Promise<D>

type Proccessed<A extends Action<Data>> = Awaited<ReturnType<A>>;


type CheckFn = (...args:any)=>TaskHandler

type Check<T extends CheckFn > = {
  fn:T
  args:Parameters<T>
}

type DataHandler<D extends Data> = (data: D) => void;

/**
 * fuction to call with payload
 */
type Procedure<T extends Action<Data>> = {
  name: string;
  action: T;
  stoppingCondition:ERROR_STATUS_TEXT[]
}&({
  //auth0 procedure
  requireAuth0Token:true;
  payload: TupleSplit<Parameters<T>, 1>[1]; 
}|{
  requireAuth0Token:false;
  payload: Parameters<T>; 
});

/**
 * Auth0 action shd be warp by warp auth0
 *
 * A squence of procedure added to task queue when handling.
 *
 * seq: pre check -> forward -> create and push revert procedure -> push preset revert precedure -> hadnle data -> post check -> perform enqueue
 *
 * adding after action e.g. assign role after creating a/c -> adding revert procedure to stack
 */

class Task<D extends Data> {
  //check before foward proccess and data handle
  preCheck: Check<CheckFn>[] = []; //chaining of check fn
  //actual => call enqueue
  forward: Procedure<Action<D>>;
  //how to handle data
  dataHandler: DataHandler<D> = (data: D) => {};
  //take enque data and add a revert action to stack
  createRevert?: (data: D) => Procedure<Action<D>>;
  //direct procedure to add
  revertProcedure?: Procedure<Action<any>>;
  //check after data handle and forward process
  postCheck:Check<CheckFn>[]=[]
  //additional action after handle data 
  enqueue: DataHandler<D> = (data: D) => {};
  constructor(forward: Procedure<Action<D>>) {
    this.forward = forward;
  }
  addPreCheck(fn: Check<any> | Check<any>[]) {
    if (Array.isArray(fn)) {
      this.preCheck.concat(fn);
    } else {
      this.preCheck.push(fn);
    }
    return this;
  }
  addPostCheck(fn: Check<any> | Check<any>[]) {
    if (Array.isArray(fn)) {
      this.postCheck.concat(fn);
    } else {
      this.postCheck.push(fn);
    }
    return this;
  }
  setDataHandler(handler: DataHandler<D>) {
    this.dataHandler = handler;
    return this;
  }
  setCreateRevert(fn: (data: D) => Procedure<Action<D>>) {
    this.createRevert = fn;
    return this;
  }
  setRevert(procedure: Procedure<Action<any>>) {
    this.revertProcedure = procedure;
    return this;
  }
  setEnqueue(fn: DataHandler<D>) {
    this.enqueue = fn;
    return this;
  }
}

export class TaskHandler {
  private require_token = false;
  private auth0_token: string | undefined;
  private task_queue: Task<any>[] = [];
  private revert_stack: Procedure<Action<Data>>[] = [];
  private error_status_text: ERROR_STATUS_TEXT | undefined; //!undefined -> error occurs -> stop process and revert changes
  private error_messages: string[] = [];

  /**
   * email -> user data
   */
  private users = new Map<string, RoledUserType>();
  /**
   * class_id -> class data
   */
  private classes = new Map<string, ClassType>();

  //logic to call directly
  //todo...

  public logic = {
    createSingleUser:(payload:PostUsersReqType)=>{
      const classPayloads = this.classUpdatePaylaodsFromCreateUser(payload)
      classPayloads.forEach(payload=>{
        this.addCheckClassUpdatetable(payload).addUpdateClass(payload)
      })
      this.addCreateUser(payload)
    }
  }

  //handler error when over try limit
  private handleError = (name: string, error: any) => {
    const handler = new ServerErrorHandler(error);
    //only keeping the first status
    if (!this.error_status_text) {
      this.error_status_text = handler.status_text;
    }
    this.error_messages.push(`${name} Failed: ` + handler.message);
  };

  //process procudeure
  private async process<A extends Action<Data>>(
    procedure: Procedure<A>,
    tried: number = 1
  ): Promise<Proccessed<A>> {
    const { action, payload, name, requireAuth0Token,stoppingCondition } = procedure;
    console.log(`Procesing ${name}`);
    if (tried > TRY_LIMIT)
      throw new APIError("Internal Server Error", "Try Limit Exceeded");
    try {
      //try to call the procedure
      if(requireAuth0Token){
        //pass token as for first prams if token is required
        const token = this.auth0_token
        if(!token) throw new APIError("Internal Server Error","Auth0 Access Token Not Set")
        const data = await action.apply(this,[token,...payload])
        //return if no error
        console.log(`${name} done.`)
        return data as Proccessed<A>;
      }else{
        const data = await action.apply(this,[...payload])
        console.log(`${name} done.`)
        //return if no error
        return data as Proccessed<A>;
      }
    } catch (error: any) {
      //exceed limit and throw the error
      if (tried >= TRY_LIMIT) {
        throw error
      }
      //hit the stopping condition (e.g. user not found) => DO NOT try agn
      if (error instanceof APIError && stoppingCondition.includes(error.status)) {
        throw error
      }
      //try again
      await wait();
      return await this.process(procedure,  tried + 1);
    }
  }

  //utils
  /**
   *
   * @param payload create user payload
   * @returns class_ids,updatePayloads
   */
  private classUpdatePaylaodsFromCreateUser(
    payload: Parameters<typeof createUser>[1]
  ):ClassUpdatePaylod[] {
    const { role, enrolled_class_id, teaching_class_ids, email } = payload;
    if (role === "managedStudent" && enrolled_class_id) {
      const payload:ClassUpdatePaylod =  {
        class_id: enrolled_class_id,
        addStudents: [email],
      };
      return [payload]
    }
   if (role === "teacher" && teaching_class_ids) {
      const payloads: ClassUpdatePaylod[] = teaching_class_ids.map((id) => {
        return {
          class_id: id,
          addTeachers: [email],
        };
      });
      return payloads
    }
    return []
  }

  private classUpdatePayloadsFromBatchCreate(payload: BatchCreateUserReqType):ClassUpdatePaylod[] {
    const { role, enrolled_class_id, teaching_class_ids, users } = payload;
    if (role === "managedStudent" && enrolled_class_id) {
      const payload = {
        class_id: enrolled_class_id,
        addStudents: users.map((user) => user.email),
      };
      return [payload]
    }
    if (role === "teacher" && teaching_class_ids) {
      const payloads= teaching_class_ids.map((id) => {
        return {
          class_id: id,
          addTeachers: users.map((user) => user.email),
        };
      });
      return payloads
    }
    return [];
  }

  createNoTokenProcedure<A extends Action<Data>>(
    name: string,
    action: A,
    payload: Parameters<A>,
    condition?:ERROR_STATUS_TEXT[]
  ): Procedure<A> {
    return { name, action, payload, stoppingCondition:condition??[],requireAuth0Token: false };
  }

  createAuth0Procedure<A extends AuthAction<Data>>(
    name: string,
    action: A,
    payload: TupleSplit<Parameters<A>, 1>[1],
    condition?:ERROR_STATUS_TEXT[]
  ): Procedure<A> {
    this.require_token = true
    return {
      name,
      action,
      payload,
      stoppingCondition:condition??[],
      requireAuth0Token: true,
    };
  }

  createCheck<T extends CheckFn>(fn:T,args:Parameters<T>):Check<T>{
    return{fn,args}
  }

  //handle data
  private handleUserData(data:RoledUserType|RoledUserType[]|undefined){
    if(data===undefined) return
    if(!Array.isArray(data)){
      data= [ data]
    }
    data.forEach(entry=>this.users.set(entry.email,entry))
  }

  private handleClassData(data:ClassType|ClassType[]|undefined){
    if(data===undefined) return
    if(!Array.isArray(data)){
      data= [ data]
    }
    data.forEach(entry=>this.classes.set(entry.class_id,entry))
  }

  //checking fn s,throw error if check fail

  /**
   * check if handler have all required user
   * @param emails
   * @param role
   */
  private haveUsersData(
    emails: string[],
    role: UserRoleType | undefined = undefined
  ) {
    const data: RoledUserType[] = [];
    const missing: string[] = [];
    emails.forEach((key) => {
      const user = this.users.get(key);
      //true if user hv the requred role || role is not defined || user is not defined
      const satisfyRole = role ? user?.roles.includes(role) : true;
      //user is not undefined && (user has role || role is not defined)
      if (user && satisfyRole) {
        data.push(user);
      } else {
        missing.push(key);
      }
    });
    if (missing.length)
      throw new APIError(
        "Resource Not Found",
        `${missing.join(", ")} are not present ${role ?? "user"} in handler`
      );
    return this;
  }

  private haveUserData(
    email: string,
    role: UserRoleType | undefined = undefined
  ) {
    const data = this.users.get(email);
    //true if user hv the requred role || role is not defined || user is not defined
    const satisfyRole = role ? data?.roles.includes(role) : true;
    //user is  undefined  || user is not the  role
    if (!data || !satisfyRole)
      throw new APIError(
       "Resource Not Found",
        `Required ${role ?? "user"} not found in handler`
      );
    return this;
  }

  /**
   * check if hanlder contains the required class
   * @param class_id
   */
  private haveClassData(class_id: string) {
    const data = this.classes.get(class_id);
    if (!data)
      throw new APIError(
        "Implementation Error",
        "Required class not found in handler"
      );
    return this;
  }


  /**
   * Prerequisite: users exist in auth0 db
   *
   * Checking: user(s) exist in correct role
   *
   * Task to be added : (batch) get users and check
   *
   * Procedure pushed to Revert Stack: none
   * @param emails user emails
   * @param role  user role
   * @returns void
   */
  // private addCheckValidUsers(
  //   emails: string[],
  //   role: UserRoleType | undefined = undefined
  // ) {
  //   if (emails.length === 0) return; //no check required
  //   this.require_token = true;
  //   if (emails.length === 1) {
  //     //single get
  //     const email = emails[0];
  //     const token = this.haveAuth0Token();
  //     const task: Task = async () => {
  //       const procedure: Procedure<typeof getUserByEmail> = {
  //         name: `Get User For Checking, email: ${email}`,
  //         action: getUserByEmail,
  //         payload: [token, email],
  //       };
  //       //process
  //       const data = await this.process(procedure);
  //       //handle data
  //       this.handleUserData(data);
  //       //no revert
  //       const checked = this.haveUserData(email, role);
  //     };
  //     this.task_queue.push(task);
  //   } else {
  //     //use search
  //     const token = this.haveAuth0Token();
  //     const task: Task = async () => {
  //       const query: SerachQuery = {
  //         email: emails,
  //         type: "OR",
  //       };
  //       const procedure: Procedure<typeof searchUser> = {
  //         name: `Search Users For Checking`,
  //         action: searchUser,
  //         payload: [token, query],
  //       };
  //       //process
  //       const data = await this.process(procedure);
  //       //handle data
  //       this.handleUsersData(data);
  //       //no revert
  //       const checked = this.haveUsersData(emails, role);
  //     };
  //     this.task_queue.push(task);
  //   }
  // }

  /**
   * Prerequisite:  class exist and updatble
   *
   * Checking: Auth0 token present
   *
   * Task to be added : user create and role assign.
   *
   * Procedure pushed to Revert Stack: Delete user
   * @param payload request body of create user
   */
  private addCreateUser(payload: Parameters<typeof createUser>[1]) {
    this.require_token = true;
    //todo =>check classs updabale
    const createUserProcedure = this.createAuth0Procedure(
      `Create Account for ${payload.email}`,
      createUser,
      [payload],
      ["Conflict","Bad Request"]
    );

    const myTask = new Task(createUserProcedure);
    myTask
      .setDataHandler(this.handleUserData)
      .setCreateRevert((data) => {
        const revertProcedure = this.createAuth0Procedure(
          `Revert A/C Creation for ${payload.email}`,
          deleteUser,
          [data.user_id],
          ["Resource Not Found"]
        );
        return revertProcedure;
      })
      .setEnqueue((data) => {
        const { email, name, user_id } = data;
        this.addAssignRole(
          user_id,
          payload.role,
          false,
          data
        )
        .addSendInvitation(email, name);
      });

    this.task_queue.push(myTask);
    return this;
  }

  /**
   * Prerequisite:  
   * 
   * Task to be added : assign role to user (update user data in property if user is provided)
   *
   * Procedure pushed to Revert Stack: delete user role
   * @param user_id 
   * @param role 
   * @param revert //default ture, willl not add revert action if set to false
   * @param user   //will udpate data in propery if provide the corrisponding user data
   * @returns 
   */
  private addAssignRole(
    user_id: string,
    role: UserRoleType,
    revert: boolean = true,
    user?: RoledUserType
  ) {
    this.require_token = true;
    const procedure = this.createAuth0Procedure(
      `Assign ${role}, user_id: ${user_id}`,
      assignRole,
      [user_id, role, user],
      ["Resource Not Found"]
    );
    const myTask = new Task(procedure);
    myTask.setDataHandler(this.handleUserData)
    //if revert ...
    if(revert){
      const revert = this.createAuth0Procedure(`Revert Assign ${role}, user_id: ${user_id}`,deleteRole,[user_id,role,user],["Resource Not Found"])
      myTask.setRevert(revert)
    }
    this.task_queue.push(myTask)
    return this;
  }
  /**
   * Prerequisite: none
   *
   * Checking: have auth0 token
   *
   * Task to be added : get user by email
   *
   * Procedure pushed to Revert Stack: none
   * @param email user email
   */
  // private addFindUserByEmail(email: string) {
  //   this.require_token = true;
  //   const task: Task = async () => {
  //     const token = this.haveAuth0Token();
  //     const procedure: Procedure<typeof getUserByEmail> = {
  //       name: `Get Data of ${email}`,
  //       action: getUserByEmail,
  //       payload: [token, email],
  //     };
  //     //process
  //     const user = await this.process(procedure, "Resource Not Found");
  //     //handle data
  //     this.handleUserData(user);
  //     //no revert
  //   };
  //   this.task_queue.push(task);
  // }
  /**
   * Prerequisite: none
   *
   * Checking: have auth0 token
   *
   * Task to be added : search users
   *
   * Procedure pushed to Revert Stack: none
   * @param query search query
   */
  // private addSearchUsers(query: SerachQuery) {
  //   this.require_token = true;
  //   const task: Task = async () => {
  //     const token = this.haveAuth0Token();
  //     const procedure: Procedure<typeof searchUser> = {
  //       name: "Search Users",
  //       action: searchUser,
  //       payload: [token, query],
  //     };
  //     //process
  //     const users = await this.process(procedure);
  //     //handle data
  //     this.handleUsersData(users);
  //     //no revert
  //   };
  //   this.task_queue.push(task);
  // }

  /**
   * Prerequisite:  none
   *
   * Checking: none
   *
   * Task to be added : update class data
   *
   * Procedure pushed to Revert Stack: none
   * @param class_id class id to search
   */
  // private addGetClass(class_id: string) {
  //   const task: Task = async () => {
  //     const procedure: Procedure<typeof getClass> = {
  //       name: `Get class data, ID: ${class_id}`,
  //       action: getClass,
  //       payload: [class_id],
  //     };
  //     //process
  //     const data = await this.process(procedure);
  //     //handle data
  //     this.handleClassData(data);
  //     //no revert
  //   };
  //   this.task_queue.push(task);
  // }
  /**
   * Prerequisite:  none
   *
   * Checking: none
   *
   * Task to be added : batch get class data
   *
   * Procedure pushed to Revert Stack: none
   * @param class_ids class IDs to get
   */
  // private addBatchGetClasses(class_ids: string[]) {
  //   const task: Task = async () => {
  //     const procedure: Procedure<typeof scanClass> = {
  //       name: "Batch Get Class",
  //       action: scanClass,
  //       payload: [class_ids],
  //     };
  //     //process
  //     const data = await this.process(procedure);
  //     //handle data
  //     this.handleClassesData(data);
  //     //no revert
  //   };
  //   this.task_queue.push(task);
  // }


  private addCheckClassUpdatetable(payload: ClassUpdatePaylod){
    const checkProcedure = this.createNoTokenProcedure(`Check Class Updable, class_id:${payload.class_id}`,classUpdatable,[payload],["Resource Not Found","Conflict"])
    const checkTask = new Task(checkProcedure)
    //check updable and save the origanal class data
    const checkHaveClass = this.createCheck(this.haveClassData,[payload.class_id])
    checkTask.setDataHandler(this.handleClassData).addPostCheck(checkHaveClass)
    this.task_queue.push(checkTask)
    return this
  }

  /**
   *
   * Prerequisite:  user exist ad in correct type => handle by update user check
   * 
   * Task to be added : check class updable and update class
   *
   * Procedure pushed to Revert Stack: Update Class to previous data
   * @param payload params of updateClass
   */
  private addUpdateClass(payload: ClassUpdatePaylod) {
   
    
    //perform update
    const updateProcedure = this.createNoTokenProcedure(`Update class, ID: ${payload.class_id}`,updateClass,[payload])
    const updateTask = new Task(updateProcedure)
    //add precheck -> hv class data
    const checkHaveClass = this.createCheck(this.haveClassData,[payload.class_id])
    updateTask.addPreCheck(checkHaveClass).setCreateRevert(data=>{
      const { class_id, class_name, capacity, available_modules } = this.getSingleClass(data.class_id) //old class
      const { addStudents, addTeachers, removeStudents, removeTeachers } = payload; //update action
      const revertPayload: ClassUpdatePaylod = {
        class_id,
        class_name,
        capacity,
        available_modules: Array.from(available_modules ?? []),
        addStudents: removeStudents,
        removeStudents: addStudents,
        addTeachers: removeTeachers,
        removeTeachers: addTeachers,
      };
      const procedure = this.createNoTokenProcedure(`Revert Class Update, ID: ${data.class_id}`,updateClass,[revertPayload])
      return procedure
    }).setDataHandler(this.handleClassData) //update class data

    this.task_queue.push(updateTask)
    return this
  }

  /**
   *
   * Prerequisite:  user exist in Auth0 (expensive check)
   *
   * Checking: have auth0 token
   *
   * Task to be added : send invitation email
   *
   * Procedure pushed to Revert Stack: none
   * @param email user email
   * @param name username
   */
  private addSendInvitation(email: string, name: string) {
    const procedure = this.createAuth0Procedure(
      `Send Invitation to ${name}`,
      sendInvitation,
      [name, email]
    );
    const myTask = new Task(procedure);
    this.task_queue.push(myTask);
    return this;
  }

  //some dummy task to add to queue

  //get data from property
  getSingleUser(email: string, role?: UserRoleType) {
    const user = this.users.get(email);
    const satistfy = user && (role ? user.roles.includes(role) : true);
    if (!satistfy)
      throw new APIError(
        "Resource Not Found",
        `${email} is not a valid ${role ?? "user"}`
      );
    return user;
  }

  getUsers(emails: string[], role?: UserRoleType) {
    const missing: string[] = [];
    const users: RoledUserType[] = [];
    emails.forEach((email) => {
      const data = this.users.get(email);
      const saftisfy = data && (role ? data.roles.includes(role) : true);
      if (!saftisfy) missing.push(email);
      else users.push(data);
    });
    if (missing.length)
      throw new APIError(
        "Resource Not Found",
        `${missing.join(", ")} are not present ${role ?? "user"}s in handler`
      );
    return users;
  }

  getSingleClass(class_id: string) {
    const data = this.classes.get(class_id);
    if (!data)
      throw new APIError(
        "Resource Not Found",
        `Class id ID: ${class_id} not found`
      );
    return data;
  }

  getClasses(class_ids: string[]) {
    const classes: ClassType[] = [];
    const missing: string[] = [];
    class_ids.forEach((id) => {
      const data = this.classes.get(id);
      if (!data) missing.push(id);
      else classes.push(data);
    });
    if (missing.length)
      throw new APIError(
        "Resource Not Found",
        `${missing.join(", ")} are not valid class IDs `
      );
    return classes;
  }

  getAuth0Token() {
    if (!this.auth0_token)
      throw new APIError("Implementation Error", "Access Token is not set");
    return this.auth0_token;
  }

  private async doTask(task: Task<Data>) {
    const {
      preCheck,
      postCheck,
      forward,
      dataHandler,
      createRevert,
      revertProcedure,
      enqueue,
    } = task;
    //pre check
    try {
      //check is passed if no error thrown
      preCheck.forEach( obj => {
        const {fn,args} = obj
        fn.apply(this,args)
      });
    } catch (error) {
      //stop the task if checking is not passed
      this.handleError("Preprocess Checking", error);
      return;
    }
    try {
      const data = await this.process(forward);
      //only call the FNs if there is no error in proccessing
      if (this.error_status_text) return;
      //add revert directly
      if (revertProcedure) {
        try {
          this.revert_stack.push(revertProcedure);
        } catch (error) {
          this.handleError("Push Revert Procedure", error);
          return;
        }
      }
      //create and add revert
      if (createRevert) {
        try {
          const procedure = createRevert.apply(this, [data]);
          this.revert_stack.push(procedure);
        } catch (error) {
          this.handleError("Create Revert Procedure", error);
          return;
        }
      }
      //handle data
      try {
        dataHandler.apply(this, [data]);
      } catch (error) {
        this.handleError("Handle Data", error);
        return;
      }
      //post check
      try {
        postCheck.forEach( obj => {
          const {fn,args} = obj
          fn.apply(this,args)
        });
      } catch (error) {
        //stop the task if checking is not passed
        this.handleError("Postprocess Checking", error);
        return;
      }
      //handle additional action
      try {
        enqueue.apply(this, [data]);
      } catch (error) {
        this.handleError("Apply Enqueue", error);
        return;
      }
    } catch (error) {
      //the only uncatch error is error from forward process
      this.handleError(forward.name,error)
    }
    return;
  }

  //revert from the end of stack
  private async revertChanges(): Promise<void> {
    const procedure = this.revert_stack.pop();
    if (!procedure) return; //empty revert stack
    //revert the changaes as much as it can
    try {
      await this.process(procedure);
    } catch (error) {
      this.handleError(procedure.name, error);
    }
    await wait();
    return await this.revertChanges();
  }

  async start(): Promise<void> {
    //stop  when error occurs
    if (this.error_status_text) {
      //revert the changes
      await this.revertChanges();
      //handle by api
      throw new APIError(
        this.error_status_text,
        this.error_messages.join(", ")
      );
    }

    //get token first before continue to process tasks
    if (this.require_token && !this.auth0_token) {
      const procedure = this.createNoTokenProcedure(
        "Get Auth0 Access Token",
        getAccessToken,
        []
      );
      try {
        this.auth0_token = await this.process(procedure);
      } catch (error) {
        //exceed try limit, failing checking or unexpected error
        this.handleError(procedure.name, error);
      }
      return await this.start();
    }

    //deque the task and handle it as the handler

    const task = this.task_queue.shift(); //deque the first task from queue
    if (!task) return; //no task remain

    await this.doTask(task);

    await wait();
    return await this.start();
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
