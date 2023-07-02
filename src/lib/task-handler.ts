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
  deleteUser,
  getAccessToken,
  getUserByEmail,
  searchUser,
  sendInvitation,
} from "./auth0_user_management";
import { getClass, scanClass, updateClass } from "./class_management";
import {
  ClassType,
  classArraySchema,
  classSchema,
} from "@/models/dynamoDB_schemas";
import { delay } from "./utils";
import { BatchCreateUserReqType, PostUsersReqType, PutUsersReqType, emailSchema } from "@/models/api_schemas";

const TRY_LIMIT = 3; //error hitting limit

const DEFAULT_WAITING_TIME = 500; //in ms

function wait(time: number | undefined = undefined) {
  return delay(time ?? DEFAULT_WAITING_TIME);
}

//awaited return type of actions
type Data =
  | RoledUserType
  | RoledUserType[]
  | ClassType
  | ClassType[]
  | string
  | void;

type Proccessed<A extends Action> = Awaited<ReturnType<A>>;

/**
 * fuction to call with payload
 */
type Action = (...args: any) => Promise<Data>;

/**
 * fuction to call with payload
 */
type Procedure<T extends Action> = {
  name: string;
  action: T;
  payload: Parameters<T>;
};

/**
 * A squence of procedure added to task queue when handling.
 * 
 * i.e. checking conditions -> doing actual action -> handle data
 * 
 * adding after action e.g. assign role after creating a/c -> adding revert procedure to stack
 */
type Task = () => Promise<void>;

class TaskHandler {
  private require_token = false;
  private auth0_token: string | undefined;
  private task_queue: Task[] = [];
  private revert_stack: Procedure<Action>[] = [];
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
public readonly logic = {
  user:{
    createSingleUser: (payload: PostUsersReqType) => {
      const classPaylaods = this.classUpdatePaylaodsFromCreateUser(payload);
      this.addCheckClassUpdatable(classPaylaods);
      this.addCreateUser(payload);
      classPaylaods.forEach((data) => this.addUpdateClass(data));
      this.addSendInvitationByEmail(payload.email)
    },
    batchCreateUsers:(payload:BatchCreateUserReqType)=>{
      const {users,role,enrolled_class_id,teaching_class_ids,available_modules,account_expiration_date} = payload
      const classPaylaods = this.classUpdatePayloadsFromBatchCreate(payload)
      this.addCheckClassUpdatable(classPaylaods);
      users.forEach(user=>{
        this.addCreateUser({
          ...user,role,enrolled_class_id,teaching_class_ids,available_modules,account_expiration_date
        })
      })
      classPaylaods.forEach(data=>this.addUpdateClass(data))
      users.forEach(user=>{
        this.addSendInvitationByEmail(user.email)
      })
    },
    getUserByEmail:(email:string)=>{
      this.addFindUserByEmail(email)
    },
    serachUsers:(query:SerachQuery)=>{
      this.addSearchUsers(query)
    }
  },
  class:{
    getSingleClass:(class_id:string)=>{
      this.addGetClass(class_id)
    },
    batchGetClass:(class_ids:string[])=>{
      this.addBatchGetClasses(class_ids)
    }
  },
  email:{
    resendInvitation:(email:string)=>{
      this.addFindUserByEmail(email)
      this.addSendInvitationByEmail(email)
    }
  }
};
  //handler error when over try limit
  private handleError = (error: any) => {
    const handler = new ServerErrorHandler(error);
    //only keeping the first status
    if (!this.error_status_text) {
      this.error_status_text = handler.status_text;
    }
    this.error_messages.push(handler.message);
  };

  //process procudeure
  private async process<T extends Action>(
    procedure: Procedure<T>,
    stoppingStatus: ERROR_STATUS_TEXT | undefined = undefined,
    tried: number = 1
  ): Promise<Proccessed<T>> {
    const { action, payload,name } = procedure;
    console.log(`Procesing ${name}`)
    if (tried > TRY_LIMIT)
      throw new APIError("Internal Server Error", "Try Limit Exceeded");
    try {
      //try to call the procedure
      const data = await action(...payload);
      //return if no error
      return data as Proccessed<T>;
    } catch (error: any) {
      //exceed limit and throw the error
      if (tried >= TRY_LIMIT) {
        throw error;
      }
      //hit the stopping condition (e.g. user not found) => DO NOT try agn
      if (error instanceof APIError && error.status == stoppingStatus) {
        throw error;
      }
      //try again
      await wait();
      return await this.process(procedure, stoppingStatus, tried + 1);
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
  ) {
    const { role, enrolled_class_id, teaching_class_ids, email } = payload;
    const updatePaylaods: Parameters<typeof updateClass>[0][] = [];
    if (role === "managedStudent" && enrolled_class_id) {
      updatePaylaods.push({
        class_id: enrolled_class_id,
        addStudents: [email],
      });
    }
    if (role === "teacher" && teaching_class_ids) {
      const payloads: typeof updatePaylaods = teaching_class_ids.map((id) => {
        return {
          class_id: id,
          addTeachers: [email],
        };
      });
      updatePaylaods.concat(payloads);
    }
    return updatePaylaods;
  }

  private classUpdatePayloadsFromBatchCreate(payload:BatchCreateUserReqType){
    const { role, enrolled_class_id, teaching_class_ids, users } = payload;
    const updatePaylaods: Parameters<typeof updateClass>[0][] = [];
    if (role === "managedStudent" && enrolled_class_id) {
      updatePaylaods.push({
        class_id: enrolled_class_id,
        addStudents: users.map(user=>user.email),
      });
    }
    if (role === "teacher" && teaching_class_ids) {
      const payloads: typeof updatePaylaods = teaching_class_ids.map((id) => {
        return {
          class_id: id,
          addTeachers: users.map(user=>user.email),
        };
      });
      updatePaylaods.concat(payloads);
    }
    return updatePaylaods
  }

  //handle data
  private handleUserData(user: RoledUserType) {
    this.users.set(user.email, user);
  }

  private handleUsersData(users:RoledUserType[]){
    users.forEach(user=>{
      this.users.set(user.email,user)
    })
  }

  private handleClassData(data: ClassType) {
    this.classes.set(data.class_id, data);
  }

  private handleClassesData(classes: ClassType[]) {
    classes.forEach((data) => {
      this.classes.set(data.class_id, data);
    });
  }

  //checking fn s,throw error if check fail

  /**
   *
   * @returns Auth0 token string
   */
  private haveAuth0Token(): string {
    const token = this.auth0_token;
    if (!token)
      throw new APIError(
        "Implementation Error",
        "Auth0 Access Token is not set"
      );
    return token;
  }

  /**
   * check if handler have all required user
   * @param emails
   * @param role
   * @returns filtered users data
   */
  private haveUsersData(
    emails: string[],
    role: UserRoleType | undefined = undefined
  ): RoledUserType[] {
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
        "Implementation Error",
        `${missing.join(", ")} are not present ${role ?? "user"} in handler`
      );
    return data;
  }

  private haveUserData(
    email: string,
    role: UserRoleType | undefined = undefined
  ): RoledUserType {
    const data = this.users.get(email);
    //true if user hv the requred role || role is not defined || user is not defined
    const satisfyRole = role ? data?.roles.includes(role) : true;
    //user is  undefined  || user is not the  role 
    if (!data||!satisfyRole)
      throw new APIError(
        "Implementation Error",
        `Required ${role ?? "user"} not found in handler`
      );
    return data;
  }

  /**
   * check if hanlder contains the required class
   * @param class_id
   * @returns class data, throw error if data not persent
   */
  private haveClassData(class_id: string): ClassType {
    const data = this.classes.get(class_id);
    if (!data)
      throw new APIError(
        "Implementation Error",
        "Required class not found in handler"
      );
    return data;
  }

  /**
   * Prerequisite: user exist(or going to be created)
   *
   * check whther the classexist and can be updated by input value,checking update content
   * @param class_id
   * @param update
   * @returns true , throw error if not updable
   */
  private canUpdateClass(payload: Parameters<typeof updateClass>[0]) {
    const {
      class_id,
      class_name,
      capacity,
      available_modules,
      addStudents,
      addTeachers,
      removeStudents,
      removeTeachers,
    } = payload;
    if (
      !(
        class_name ||
        capacity ||
        addStudents ||
        addTeachers ||
        removeStudents ||
        removeTeachers ||
        available_modules
      )
    )
      return true; //no update
    //check if class exist
    const target = this.haveClassData(class_id);
    //check if class capac
    if (capacity || addStudents) {
      const currentCapacity = capacity ?? target.capacity;
      const modifiedStudents = target.student_ids ?? new Set();
      for (const id of addStudents ?? []) {
        modifiedStudents.add(id);
      }
      for (const id of removeStudents ?? []) {
        modifiedStudents.delete(id);
      }
      if (modifiedStudents.size > currentCapacity)
        throw new APIError(
          "Conflict",
          "Resulting number of students exceeds capacity."
        );
    }
    return true;
  }

  //todo:
  //users: crud single user, batch create and search users
  //classes: crud single class, batch get class, batch update class maybe
  //email: send invitation for all users in property, resend email

  /**
   * Prerequisite: users exist orbeing created
   * 
   * Checking: class exist and upadable
   *
   * Task to be added : batch get classes and check
   *
   * Procedure pushed to Revert Stack: none
   * @param payload create user payload
   * @returns void
   */
  private addCheckClassUpdatable(
    updatePaylaods: Parameters<typeof updateClass>[0][]
  ) {
    if (updatePaylaods.length === 0) return; // no need check class
    const task: Task = async () => {
      const batchGetClassesProcedure: Procedure<typeof scanClass> = {
        name: "Get Classes for Checking User Creation",
        action: scanClass,
        payload: [updatePaylaods.map((paylaod) => paylaod.class_id)],
      };
      const classes = await this.process(batchGetClassesProcedure);
      //handle data
      this.handleClassesData(classes);
      //check if all present and updatable
      const check = updatePaylaods.map((payload) =>
        this.canUpdateClass(payload)
      );
    };
    this.task_queue.push(task);
  }

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
    const task: Task = async () => {
      //checking:check token
      const token = this.haveAuth0Token();
      //create user
      const createUserProcedure: Procedure<typeof createUser> = {
        name: `Create Account for ${payload.email}`,
        action: createUser,
        payload: [token, payload],
      };
      const user = await this.process(createUserProcedure);
      //adding revert
      const revertCreateUserProcedure: Procedure<typeof deleteUser> = {
        name: `Revert A/C Creation for ${payload.email}`,
        action: deleteUser,
        payload: [token, user.user_id],
      };
      this.revert_stack.push(revertCreateUserProcedure);
      //assign role
      const assignRoleProcedure: Procedure<typeof assignRole> = {
        name: `Assign ${payload.role} to ${payload.email}`,
        action: assignRole,
        payload: [token, user.user_id, payload.role],
      };
      const assignedRole = await this.process(assignRoleProcedure);
      //handle data
      const roledUser: RoledUserType = { ...user, role: [assignedRole] };
      this.handleUserData(roledUser);
    };
    this.task_queue.push(task);
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
  private addFindUserByEmail(email:string){
    this.require_token = true
    const task:Task = async ()=>{
      const token = this.haveAuth0Token()
      const procedure:Procedure<typeof getUserByEmail>={
        name:`Get Data of ${email}`,
        action:getUserByEmail,
        payload:[token,email]
      }
      //process
      const user = await this.process(procedure,'Resource Not Found')
      //handle data
      this.handleUserData(user)
      //no revert
    }
    this.task_queue.push(task)
  }
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
  private addSearchUsers(query:SerachQuery){
    this.require_token = true
    const task:Task =async()=>{
      const token = this.haveAuth0Token()
      const procedure:Procedure<typeof searchUser>={
        name:"Search Users",
        action:searchUser,
        payload:[token,query]
      }
      //process
      const users = await this.process(procedure)
      //handle data
      this.handleUsersData(users)
      //no revert
    }
    this.task_queue.push(task)
  }

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
  private addGetClass(class_id:string){
    const task:Task = async ()=>{
     const procedure:Procedure<typeof getClass>={
      name:`Get class data, ID: ${class_id}`,
      action:getClass,
      payload:[class_id]
     }
     //process
     const data =  await this.process(procedure)
     //handle data
     this.handleClassData(data)
     //no revert
    }
    this.task_queue.push(task)
  }
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
  private addBatchGetClasses(class_ids:string[]){
    const task:Task = async()=>{
      const procedure:Procedure<typeof scanClass> ={
        name:"Batch Get Class",
        action:scanClass,
        payload:[class_ids]
      }
      //process
      const data = await this.process(procedure)
      //handle data
      this.handleClassesData(data)
      //no revert
    }
    this.task_queue.push(task)
  }

  /**
   *
   * Prerequisite:  class exist and updatble
   *
   * Checking: class exist
   *
   * Task to be added : update class data
   *
   * Procedure pushed to Revert Stack: Update Class to previous data
   * @param payload params of updateClass
   */
  private addUpdateClass(payload: Parameters<typeof updateClass>[0]) {
    const task: Task = async () => {
      const previous = this.haveClassData(payload.class_id);
      const updateProcedure: Procedure<typeof updateClass> = {
        name: `Update class, ID:${payload.class_id}`,
        action: updateClass,
        payload: [payload],
      };
      //update
      const updated = await this.process(updateProcedure);
      //add revert
      //update to original name and capac
      const { class_id, class_name, capacity,available_modules } = previous;
      //revert the adding and removing
      const { addStudents, addTeachers, removeStudents, removeTeachers } =
        payload;
      const revertPayload: Parameters<typeof updateClass>[0] = {
        class_id,
        class_name,
        capacity,
        available_modules:Array.from(available_modules??[]),
        addStudents: removeStudents,
        removeStudents: addStudents,
        addTeachers: removeTeachers,
        removeTeachers: addTeachers,
      };
      const revertProcedure: Procedure<typeof updateClass> = {
        name: `Revert updating class, ID:${class_id}`,
        action: updateClass,
        payload: [revertPayload],
      };
      this.revert_stack.push(revertProcedure);
      //process data
      this.handleClassData(updated);
    };
    //add to queue
    this.task_queue.push(task);
  }

  /**
   *
   * Prerequisite:  user exist in Auth0 (expensive check)
   *
   * Checking: user exist in property, have auth0 token
   *
   * Task to be added : send invitation email
   *
   * Procedure pushed to Revert Stack: none
   * @param email user email
   */
  private addSendInvitationByEmail(email: string) {
    this.require_token = true;
    const task: Task = async () => {
      //check
      const user = this.haveUserData(email);
      const token = this.haveAuth0Token();
      const invitationProcedure: Procedure<typeof sendInvitation> = {
        name: `Send invitation to ${email}`,
        action: sendInvitation,
        payload: [token, user.name, user.email],
      };
      await this.process(invitationProcedure);
      //no need handle data and add revert
    };
    this.task_queue.push(task);
  }

  //some dummy task to add to queue

  //get data from property
  getSingleUser(email:string){
    try {
      const user = this.haveUserData(email)
      return user
    } catch (error:any) {
      throw new APIError("Resource Not Found",error.message??"Unknown")
    }
  }

  getUsers(emails:string[]){
    try {
      const users = this.haveUsersData(emails)
      return users
    } catch (error:any) {
      throw new APIError("Resource Not Found",error.message??"Unknown")
    }
  }

  getSingleClass(class_id:string){
    try {
      const data = this.haveClassData(class_id)
      return data
    } catch (error:any) {
      throw new APIError("Resource Not Found",error.message??"Unknown")
    }
  }

  //revert from the end of stack
  private async revertChanges(): Promise<void> {
    const procedure = this.revert_stack.pop();
    if (!procedure) return; //empty revert stack
    //revert the changaes as much as it can
    try {
      await this.process(procedure);
    } catch (error) {
      this.handleError(error);
    }
    await wait();
    return this.revertChanges();
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
      const procedure: Procedure<typeof getAccessToken> = {
        name: "Get Auth0 Access Token",
        action: getAccessToken,
        payload: [],
      };
      try {
        this.auth0_token = await this.process(procedure);
      } catch (error) {
        //exceed try limit, failing checking or unexpected error
        this.handleError(error);
      }
      return await this.start();
    }

    //deque the task and handle it as the handler

    const task = this.task_queue.shift(); //deque the first task from queue
    if (!task) return; //no task remain
    try {
      //invoke the task
      await task();
    } catch (error) {
      //exceed try limit, failing checking or unexpected error
      this.handleError(error);
    }
    await wait();
    return await this.start();
  }
}

// const myHandler = new TaskHandler()
// myHandler.logic.user.getUserByEmail("dsds")
// await myHandler.start()


//optimization: class_queue,user_queue,email_queue, first two can promise.all
//depenedce can be complicated
//but not really make that much difference cuz class operation are fast and usually batch action except update mutiple class
//sending email is the most time consuming but cannot asynchronously proceess wtih other queue becuz of depenence
//the final improvment maybe DEFAULT_WAITING_TIME * update actions on class DB
