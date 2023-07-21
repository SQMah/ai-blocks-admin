import { RoledUserType, UserRoleType } from "@/models/auth0_schemas";
import {
  APIError,
  ERROR_STATUS_TEXT,
  ServerErrorHandler,
  classUpdatePaylaodsFromCreateUser,
  classUpdatePayloadsFromBatchCreate,
  willUpdateUsersWhenClassUpdate,
} from "./api_utils";
import { SerachQuery } from "./auth0_user_management";
import { createClass } from "./class_management";
import { ClassType } from "@/models/dynamoDB_schemas";
import { delay } from "./utils";
import {
  BatchCreateUserReqType,
  PostUsersReqType,
  PutClassesReqType,
  UpdateUserContentType,
} from "@/models/api_schemas";
import {
  BatchGetClassTask,
  CheckClassUpdatableAndUpdateTask,
  CreateClassTask,
  CreateUserTask,
  DeleteClassByClassIDTask,
  DeleteUserByEmailTask,
  DeleteUserByIDTask,
  FindClassByIDTask,
  GetAuthTokenProcedure,
  GetUserByEmailTask,
  Procedure,
  ResendInvitationTask,
  ScearchUsersTask,
  Task,
  UpdateTeachersForClassCreateTask,
  UpdateUserByEmailTask,
  UpdateUsersForClassUpdateTask,
} from "./task-and-procedure";
import { putLogEvent } from "./cloud_watch";

export const TRY_LIMIT = 3; //error hitting limit

const DEFAULT_WAITING_TIME = 300; //in ms

export function wait(time: number | undefined = undefined) {
  return delay(time ?? DEFAULT_WAITING_TIME);
}

//awaited return type of actions
export type Data =
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
export type Action<D extends Data> = (...args: any) => Promise<D>;

export type Auth0Action<D extends Data> = (
  access_token: string,
  ...args: any
) => Promise<D>;

export type Proccessed<A extends Action<Data>> = Awaited<ReturnType<A>>;

export type DataHandler<D extends Data> = (data: D) => void;

export class TaskHandler {
  protected require_token = false;
  protected auth0_token: string | undefined;
  protected readonly task_queue: Task<any>[] = [];
  protected readonly revert_stack: Procedure<Action<Data>>[] = [];
  protected error_status_text: ERROR_STATUS_TEXT | undefined; //* undefined -> error occurs -> stop process and revert changes
  protected readonly error_messages: string[] = [];

  /**
   * email -> user data
   */
  protected users = new Map<string, RoledUserType>();
  /**
   * class_id -> class data
   */
  protected classes = new Map<string, ClassType>();

  logic = {
    createSingleUser: (payload: PostUsersReqType) => {
      const classPayloads = classUpdatePaylaodsFromCreateUser(payload);
      // console.log(classPayloads)
      this.addQueue(
        classPayloads.map(
          (data) => new CheckClassUpdatableAndUpdateTask(this, data)
        )
      );
      this.addQueue(new CreateUserTask(this, payload));
    },
    barchCreateUsers: (payload: BatchCreateUserReqType) => {
      const {
        users,
        enrolled_class_id,
        teaching_class_ids,
        available_modules,
        account_expiration_date,
        role,
      } = payload;
      const classPayloads = classUpdatePayloadsFromBatchCreate(payload);
      this.addQueue(
        classPayloads.map(
          (data) => new CheckClassUpdatableAndUpdateTask(this, data)
        )
      );
      this.addQueue(
        users.map(
          (user) =>
            new CreateUserTask(this, {
              ...user,
              enrolled_class_id,
              teaching_class_ids,
              available_modules,
              account_expiration_date,
              role,
            })
        )
      );
    },
    findUserByEmail: (email: string) => {
      this.addQueue(new GetUserByEmailTask(this, email));
    },
    searchUser: (query: SerachQuery) => {
      this.addQueue(new ScearchUsersTask(this, query));
    },
    updateUserByEmail: (email: string, update: UpdateUserContentType) => {
      this.addQueue(new UpdateUserByEmailTask(this, update, email));
    },
    deleteUserByEmail: (email: string) => {
      this.addQueue(new DeleteUserByEmailTask(this, email));
    },
    deteleUserByID: (user_id: string) => {
      this.addQueue(new DeleteUserByIDTask(this, user_id));
    },
    createClass: (
      data: Parameters<typeof createClass>[0],
      class_id: string
    ) => {
      if (data.teacher_ids.length) {
        this.addQueue(
          new UpdateTeachersForClassCreateTask(this, data.teacher_ids, class_id)
        );
      }
      this.addQueue(new CreateClassTask(this, data, class_id));
    },
    getClassByID: (class_id: string) => {
      this.addQueue(new FindClassByIDTask(this, class_id));
    },
    batchGetClass: (class_ids: string[]) => {
      this.addQueue(new BatchGetClassTask(this, class_ids));
    },
    updateClass: (payload: PutClassesReqType) => {
      const { addStudents, addTeachers, removeStudents, removeTeachers } =
        payload;
      this.addQueue(new CheckClassUpdatableAndUpdateTask(this, payload));
      if (willUpdateUsersWhenClassUpdate(payload)) {
        this.addQueue(new UpdateUsersForClassUpdateTask(this, payload));
      }
    },
    deleteClassbyID: (class_id: string) => {
      this.addQueue(new DeleteClassByClassIDTask(this, class_id));
    },
    resendInvitation: (email: string) => {
      this.addQueue(new ResendInvitationTask(this, email));
    },
  };

  //utlis

  addQueue(task: Task<any> | Task<any>[]) {
    // console.log("tasks to add",task)
    if (Array.isArray(task)) {
      for (const entry of task) {
        this.task_queue.push(entry);
      }
    } else {
      this.task_queue.push(task);
    }
    return this;
  }

  addRevert(procedure: Procedure<any> | Procedure<any>[]) {
    if (Array.isArray(procedure)) {
      for (const entry of procedure) {
        this.revert_stack.push(entry);
      }
    } else {
      this.revert_stack.push(procedure);
    }
    return this;
  }

  haveError() {
    return Boolean(this.error_status_text);
  }

  setRequireAuht0Token() {
    this.require_token = true;
    return this.require_token;
  }

  //handle data
  handleUserData(data: RoledUserType | RoledUserType[] | undefined) {
    if (data === undefined) return;
    if (!Array.isArray(data)) {
      data = [data];
    }
    data.forEach((entry) => this.users.set(entry.email, entry));
  }
  handleClassData(data: ClassType | ClassType[] | undefined) {
    if (data === undefined) return;
    if (!Array.isArray(data)) {
      data = [data];
    }
    data.forEach((entry) => this.classes.set(entry.class_id, entry));
  }

  //checking fn s,throw error if check fail

  /**
   * check if handler have all required user
   * @param emails
   * @param role
   */
  haveUsersData(emails: string[], role: UserRoleType | undefined = undefined) {
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
        `${missing.join(", ")} are not valid ${role ?? "user"}s`
      );
    return this;
  }

  haveUserData(email: string, role: UserRoleType | undefined = undefined) {
    const data = this.users.get(email);
    //true if user hv the requred role || role is not defined || user is not defined
    const satisfyRole = role ? data?.roles.includes(role) : true;
    //user is  undefined  || user is not the  role
    if (!data || !satisfyRole)
      throw new APIError(
        "Resource Not Found",
        `Required ${role ?? "user"} not found`
      );
    return this;
  }

  /**
   * check if hanlder contains the required class
   * @param class_id
   */
  haveClassData(class_id: string) {
    const data = this.classes.get(class_id);
    if (!data)
      throw new APIError("Resource Not Found", "Required class not found");
    return this;
  }

  haveClassesData(class_ids: string[]) {
    const missing: string[] = [];
    class_ids.forEach((id) => {
      const data = this.classes.get(id);
      if (!data) missing.push(id);
    });
    if (missing.length) {
      throw new APIError(
        "Resource Not Found",
        `${missing.join(", ")} are not valid class IDs.`
      );
    }
    return this;
  }

  isStudentInClass(email: string, class_id: string) {
    const student = this.users.get(email);
    if (!student || !student.roles.includes("managedStudent"))
      throw new APIError(
        "Resource Not Found",
        `${email} is not valid student.`
      );
    const enrolled = student.user_metadata?.enrolled_class_id;
    if (!enrolled || enrolled !== class_id)
      throw new APIError(
        "Bad Request",
        `${email} is not student of ${class_id}`
      );
    return this;
  }

  areStudentsInClass(emails: string[], class_id: string) {
    const data: RoledUserType[] = [];
    const missing: string[] = [];
    emails.forEach((key) => {
      const user = this.users.get(key);
      if (user?.roles.includes("managedStudent")) {
        data.push(user);
      } else {
        missing.push(key);
      }
    });
    if (missing.length)
      throw new APIError(
        "Resource Not Found",
        `${missing.join(", ")} are not valid students`
      );
    const notInClass = data.filter((user) => {
      const enrolled = user.user_metadata?.enrolled_class_id;
      return !enrolled || enrolled !== class_id;
    });
    if (notInClass.length) {
      throw new APIError(
        "Resource Not Found",
        `${notInClass
          .map((user) => user.email)
          .join(", ")} are not valid students in ${class_id}`
      );
    }
    return this;
  }

  isTeacherInClass(email: string, class_id: string) {
    const teacher = this.users.get(email);
    if (!teacher || !teacher.roles.includes("teacher"))
      throw new APIError(
        "Resource Not Found",
        `${email} is not valid teacher.`
      );
    const teaching = teacher.user_metadata?.teaching_class_ids ?? [];
    if (!teaching.includes(class_id))
      throw new APIError(
        "Bad Request",
        `${email} is not teacher of ${class_id}`
      );
    return this;
  }

  areTeachersInClass(emails: string[], class_id: string) {
    const data: RoledUserType[] = [];
    const missing: string[] = [];
    emails.forEach((key) => {
      const user = this.users.get(key);
      if (user?.roles.includes("teacher")) {
        data.push(user);
      } else {
        missing.push(key);
      }
    });
    if (missing.length)
      throw new APIError(
        "Resource Not Found",
        `${missing.join(", ")} are not valid teachers`
      );
    const notInClass = data.filter((user) => {
      const teaching = user.user_metadata?.teaching_class_ids ?? [];
      return !teaching.includes(class_id);
    });
    if (notInClass.length) {
      throw new APIError(
        "Resource Not Found",
        `${notInClass
          .map((user) => user.email)
          .join(", ")} are not valid teachers in ${class_id}`
      );
    }
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

  getAllUsers(): RoledUserType[] {
    return Array.from(this.users.values());
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
      throw new APIError("Internal Server Error", "Access Token is not set");
    return this.auth0_token;
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
  
  //handle error when reverting error
  protected async handleRevertError(procedure:Procedure<Action<Data>>,error:any){
    const errorHandler = new ServerErrorHandler(error)
    const {status_text,status_code,message} = errorHandler
    const {name,payload,action} = procedure
    const cause = `Revert Error: ${name} failed with status ${status_code}:${status_text}, message:${message} , action:${action.name}, payload:${JSON.stringify(payload)}.`
    const remaining = this.revert_stack.map(procedure=>{
      return {...procedure,action:procedure.action.name}
    })
    const toLog:string = [cause,`Remaining Revert Procedures: ${JSON.stringify(remaining)}`].join("\n")
    console.log(toLog)
    //log to cloud watch
    await putLogEvent("REVERT_ERROR",toLog)
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
      await this.handleRevertError(procedure,error)
    }
    return
  }

  async start(): Promise<void> {
    //stop  when error occurs
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

    //get token first before continue to process tasks
    if (this.require_token && !this.auth0_token) {
      const procedure = new GetAuthTokenProcedure();
      try {
        this.auth0_token = await procedure.process(this);
      } catch (error) {
        //exceed try limit, failing checking or unexpected error
        this.handleError(procedure.name, error);
      }
      return await this.start();
    }

    //deque the task and handle it as the handler

    const task = this.task_queue.shift(); //deque the first task from queue
    // console.log(task)
    if (!task) {
      //no task remain
      console.log("All tasks completed.");
      //clear revert stack?
      //this.revert_stack = [];
      return;
    }

    await task.run(this);
    // console.log(this.task_queue,this.revert_stack)
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
