import {
  Data,
  Proccessed,
  Action,
  DataHandler,
  TaskHandler,
  Auth0Action,
  TRY_LIMIT,
  wait,
} from "./task-handler";
import {
  ERROR_STATUS_TEXT,
  APIError,
  classUpdatePayloadsFromDeleteUser,
  haveRoleChange,
  classUpdatePayloadsFromUpdateUserContetnt,
  userUpdatePayloadFromClassCreation,
} from "./api_utils";
import {
  SerachQuery,
  assignRole,
  createUser,
  deleteRole,
  deleteUser,
  getAccessToken,
  getUserByEmail,
  getUserByID,
  revertUpdateUser,
  revertUserDeletion,
  searchUser,
  sendInvitation,
  updateUser,
} from "./auth0_user_management";
import { RoledUserType, UserRoleType } from "@/models/auth0_schemas";
import { PostUsersReqType, UpdateUserContentType } from "@/models/api_schemas";
import { ClassType, ClassUpdatePaylod } from "@/models/dynamoDB_schemas";
import {
  classUpdatable,
  createClass,
  deleteClass,
  getClass,
  scanClass,
  updateClass,
} from "./class_management";
import type { TupleSplit } from "./utils";

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
        console.log(
          `${this.name} failed at trial ${tried}, message:${
            error.mesage ?? "Unknown"
          }. `
        );
      }
      await wait();
    }
    throw new APIError("Internal Server Error", "Try Limit Exceeded");
  };
}

export class Auth0Procedure<A extends Auth0Action<Data>> extends Procedure<A> {
  payload: TupleSplit<Parameters<A>, 1>[1];
  process = async (instance: TaskHandler) => {
    console.log(`Procesing ${this.name}.`);
    const token = instance.getAuth0Token();
    for (let tried = 1; tried <= TRY_LIMIT; ++tried) {
      try {
        const data = await this.action.apply(instance, [
          token,
          ...this.payload,
        ]);
        //return if no error
        console.log(`${this.name} done.`);
        return data as Proccessed<A>;
      } catch (error:any) {
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
        console.log(
          `${this.name} failed at trial ${tried}, message:${
            error.mesage ?? "Unknown"
          }. `
        );
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

export class DynamoDBProcedure<A extends Action<Data>> extends Procedure<A> {
  payload: Parameters<A>;
  process = async (instance: TaskHandler) => {
    console.log(`Procesing ${this.name}.`);
    for (let tried = 1; tried <= TRY_LIMIT; ++tried) {
      try {
        const data = await this.action.apply(instance, this.payload);
        //return if no error
        console.log(`${this.name} done.`);
        return data as Proccessed<A>;
      } catch (error:any) {
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
        console.log(
          `${this.name} failed at trial ${tried}, message:${
            error.mesage ?? "Unknown"
          }. `
        );
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
  abstract forward: Procedure<Action<D>>;
  //how to handle data
  dataHandler: DataHandler<D> = (data: D) => {};
  //take enque data and add a revert action to stack
  createRevert: (data: D) => Procedure<Action<D>> | Procedure<Action<D>>[] =
    () => [];
  //direct procedure to add
  readonly revertProcedures: Procedure<Action<Data>>[] = [];
  //check after data handle and forward process
  readonly postCheck: CheckFn<any>[] = [];
  // //additional action after handle data
  // enqueue: DataHandler<D> = (data: D) => {};
  //task to enqueue that depends on data returned
  createEnqueue: (data: D) => Task<any> | Task<any>[] = () => [];

  async run(instance: TaskHandler) {
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
      instance.addRevert(this.revertProcedures);
      //create and add revert
      try {
        const procedure = this.createRevert.apply(this, [data]);
        instance.addRevert(procedure);
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
        instance.addQueue(tasks);
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

export class CreateUserTask extends Task<RoledUserType> {
  forward: Procedure<Action<RoledUserType>>;
  constructor(instance: TaskHandler, payload: PostUsersReqType) {
    instance.setRequireAuht0Token();
    super();
    this.forward = new Auth0Procedure(
      `Create Auth0 A/C Email: ${payload.email}`,
      createUser,
      [payload],
      ["Conflict"]
    );
    this.dataHandler = instance.handleUserData;
    this.createRevert = (data) => {
      return new Auth0Procedure(
        `Revert A/C Creation for ${payload.email}`,
        deleteUser,
        [data.user_id],
        ["Resource Not Found"]
      );
    };
    this.createEnqueue = (data) => {
      const { email, name, user_id } = data;
      const tasks = [
        new AssignRoleTask(instance, user_id, payload.role, false, data),
        new SendInvitationTask(instance, name, email),
      ];
      // console.log(tasks)
      return tasks;
    };
    this.postCheck.push(new CheckFn(instance.haveUserData, [payload.email]));
  }
}

// export class BatchCreateUsersTask extends Task<RoledUserType[]>{
//   forward:Procedure<Action<RoledUserType[]>>
//   constructor(instance:TaskHandler,payload:BatchCreateUserReqType){
//     super()
//     instance.setRequireAuht0Token()
//     this.
//   }
// }

export class ChangeRoleTask extends Task<RoledUserType | undefined> {
  forward: Procedure<Action<RoledUserType | undefined>>;
  constructor(
    instance: TaskHandler,
    oldRole: UserRoleType,
    newRole: UserRoleType,
    user: RoledUserType
  ) {
    instance.setRequireAuht0Token();
    super();
    this.forward = new Auth0Procedure(
      `Remove ${oldRole} Email:${user.email}`,
      deleteRole,
      [user.user_id, oldRole, user]
    );
    this.dataHandler = instance.handleUserData;
    this.postCheck.push(new CheckFn(instance.haveUserData, [user.email]));
    this.revertProcedures.push(
      new Auth0Procedure(
        `Revert Remove ${oldRole} Email:${user.email}`,
        assignRole,
        [user.user_id, oldRole, user]
      )
    );
    this.createEnqueue = (data) => {
      // throw Error();//for testing
      return new AssignRoleTask(instance, user.user_id, newRole, true, data);
    };
  }
}

export class AssignRoleTask extends Task<RoledUserType | undefined> {
  forward: Procedure<Action<RoledUserType | undefined>>;
  constructor(
    instance: TaskHandler,
    user_id: string,
    role: UserRoleType,
    revert: boolean = true,
    user?: RoledUserType
  ) {
    instance.setRequireAuht0Token();
    super();
    this.forward = new Auth0Procedure(
      `Assign ${role} ID: ${user_id}`,
      assignRole,
      [user_id, role, user]
    );
    this.dataHandler = instance.handleUserData;
    if (user) {
      this.postCheck.push(
        new CheckFn(instance.haveUserData, [user.email, role])
      );
    }
    if (revert) {
      this.revertProcedures.push(
        new Auth0Procedure(`Revert Assign ${role} ID:${user_id}`, deleteRole, [
          user_id,
          role,
          user,
        ])
      );
    }
  }
}

export class GetUserByEmailTask extends Task<RoledUserType> {
  forward: Procedure<Action<RoledUserType>>;
  constructor(instance: TaskHandler, email: string) {
    instance.setRequireAuht0Token();
    super();
    this.forward = new Auth0Procedure(
      `Get User Data Email: ${email}`,
      getUserByEmail,
      [email],
      ["Resource Not Found"]
    );
    this.dataHandler = instance.handleUserData;
    this.postCheck.push(new CheckFn(instance.haveUserData, [email]));
  }
}

export class ScearchUsersTask extends Task<RoledUserType[]> {
  forward: Procedure<Action<RoledUserType[]>>;
  constructor(instance: TaskHandler, query: SerachQuery) {
    instance.setRequireAuht0Token();
    super();
    this.forward = new Auth0Procedure(`Serach Users`, searchUser, [query]);
    this.dataHandler = instance.handleUserData;
  }
}

export class UpdateUserTask extends Task<RoledUserType> {
  forward: Procedure<Action<RoledUserType>>;
  constructor(
    instance: TaskHandler,
    update: UpdateUserContentType,
    user: RoledUserType
  ) {
    instance.setRequireAuht0Token();
    super();
    this.forward = new Auth0Procedure(
      `Update User Email: ${user.email}`,
      updateUser,
      [{ email: user.email, content: update }, user.user_id, user.roles]
    );
    this.dataHandler = instance.handleUserData;
    this.createRevert = (updated) =>
      new Auth0Procedure(
        `Revert Update User Email: ${user.email}`,
        revertUpdateUser,
        [user, updated]
      );
    //use the old user to determine the role chnage
    const roleChange = haveRoleChange(update, user.roles);
    if (roleChange) {
      this.createEnqueue = (data) =>
        new ChangeRoleTask(instance, roleChange.old, roleChange.new, data);
    }
    this.postCheck.push(new CheckFn(instance.haveUserData, [user.email]));
  }
}

export class UpdateUserByEmailTask extends Task<RoledUserType> {
  forward: Procedure<Action<RoledUserType>>;
  constructor(
    instance: TaskHandler,
    update: UpdateUserContentType,
    email: string
  ) {
    instance.setRequireAuht0Token();
    super();
    this.forward = new Auth0Procedure(
      `Find User For Update Email: ${email}`,
      getUserByEmail,
      [email]
    );
    this.dataHandler = instance.handleUserData;
    this.createEnqueue = (data) => {
      const classPayloads = classUpdatePayloadsFromUpdateUserContetnt(
        update,
        data
      );
      const classTasks = classPayloads.map(
        (payload) => new CheckClassUpdatableAndUpdateTask(instance, payload)
      );
      return [...classTasks, new UpdateUserTask(instance, update, data)];
    };
    this.postCheck.push(new CheckFn(instance.haveUserData, [email]));
  }
}

export class DeleteUserByEmailTask extends Task<RoledUserType> {
  forward: Procedure<Action<RoledUserType>>;
  constructor(instance: TaskHandler, email: string) {
    instance.setRequireAuht0Token();
    super();
    this.forward = new Auth0Procedure(
      `Find User For Deletion Email: ${email}`,
      getUserByEmail,
      [email]
    );
    this.dataHandler = instance.handleUserData;
    this.postCheck.push(new CheckFn(instance.haveUserData, [email]));
    this.createEnqueue = (data) => {
      const tasks: Task<any>[] = [];
      const classPayloads = classUpdatePayloadsFromDeleteUser(data);
      // console.log(classPayloads)
      classPayloads.forEach((payload) => {
        tasks.push(new CheckClassUpdatableAndUpdateTask(instance, payload));
      });
      tasks.push(new DeleteUserTask(instance, data));
      return tasks;
    };
  }
}

export class DeleteUserByIDTask extends Task<RoledUserType> {
  forward: Procedure<Action<RoledUserType>>;
  constructor(instance: TaskHandler, user_id: string) {
    instance.setRequireAuht0Token();
    super();
    this.forward = new Auth0Procedure(
      `Find User For Deletion ID: ${user_id}`,
      getUserByID,
      [user_id]
    );
    this.dataHandler = instance.handleUserData;
    //no chrck can be done or walk through all values pairs
    // this.postCheck.push(new CheckFn(instance.haveUserData, [email]));
    this.createEnqueue = (data) => {
      const tasks: Task<any>[] = [];
      const classPayloads = classUpdatePayloadsFromDeleteUser(data);
      // console.log(classPayloads)
      classPayloads.forEach((payload) => {
        tasks.push(new CheckClassUpdatableAndUpdateTask(instance, payload));
      });
      tasks.push(new DeleteUserTask(instance, data));
      return tasks;
    };
  }
}

export class DeleteUserTask extends Task<void> {
  forward: Procedure<Action<void>>;
  constructor(instance: TaskHandler, user: RoledUserType) {
    instance.setRequireAuht0Token();
    super();
    this.forward = new Auth0Procedure(
      `Delete User Email: ${user.email}`,
      deleteUser,
      [user.user_id]
    );
    this.revertProcedures.push(
      new Auth0Procedure(
        `Revert Delete User Email: ${user.email}`,
        revertUserDeletion,
        [user]
      )
    );
  }
}

export class SendInvitationTask extends Task<void> {
  forward: Procedure<Action<void>>;
  constructor(instance: TaskHandler, name: string, email: string) {
    instance.setRequireAuht0Token();
    super();
    this.forward = new Auth0Procedure(
      `Send Invitation Email to ${email}`,
      sendInvitation,
      [name, email],
      ["Resource Not Found"]
    );
  }
}

export class ResendInvitationTask extends Task<RoledUserType> {
  forward: Procedure<Action<RoledUserType>>;
  constructor(instance: TaskHandler, email: string) {
    instance.setRequireAuht0Token();
    super();
    this.forward = new Auth0Procedure(
      `Find User For Invitation Email: ${email}`,
      getUserByEmail,
      [email]
    );
    this.dataHandler = instance.handleUserData;
    this.postCheck.push(new CheckFn(instance.haveUserData, [email]));
    this.createEnqueue = (data) => {
      return new SendInvitationTask(instance, data.name, data.email);
    };
  }
}

export class UpdateTeachersForClassCreateTask extends Task<RoledUserType[]> {
  forward: Procedure<Action<RoledUserType[]>>;
  constructor(instance: TaskHandler, emails: string[], class_id: string) {
    instance.setRequireAuht0Token();
    super();
    this.forward = new Auth0Procedure(`Find Teachers`, searchUser, [
      { email: emails, type: "OR" },
    ]);
    this.dataHandler = instance.handleUserData;
    this.postCheck.push(
      new CheckFn(instance.haveUsersData, [emails, "teacher"])
    );
    this.createEnqueue = (users) => {
      const payloads = userUpdatePayloadFromClassCreation(users, class_id);
      return payloads.map(
        (payload) => new UpdateUserTask(instance, payload.content, payload.user)
      );
    };
  }
}

export class CreateClassTask extends Task<ClassType> {
  forward: Procedure<Action<ClassType>>;
  constructor(
    instance: TaskHandler,
    data: Parameters<typeof createClass>[0],
    class_id: string
  ) {
    super();
    this.forward = new DynamoDBProcedure(
      `Create Class Class_Name:${data.class_name}`,
      createClass,
      [data, class_id]
    );
    this.dataHandler = instance.handleClassData;
    this.postCheck.push(new CheckFn(instance.haveClassData, [class_id]));
    this.revertProcedures.push(
      new DynamoDBProcedure(
        `Revert Class Create Class_Name:${data.class_name}`,
        deleteClass,
        [class_id]
      )
    );
  }
}

export class FindClassByIDTask extends Task<ClassType> {
  forward: DynamoDBProcedure<Action<ClassType>>;
  constructor(instance: TaskHandler, class_id: string) {
    super();
    this.forward = new DynamoDBProcedure(
      `Find Class ID:${class_id}`,
      getClass,
      [class_id],
      ["Resource Not Found"]
    );
    this.dataHandler = instance.handleClassData;
    this.postCheck.push(new CheckFn(instance.haveClassData, [class_id]));
  }
}

export class BatchGetClassTask extends Task<ClassType[]> {
  forward: DynamoDBProcedure<Action<ClassType[]>>;
  constructor(instance: TaskHandler, class_ids: string[]) {
    super();
    this.forward = new DynamoDBProcedure(
      `Batch Get Class`,
      scanClass,
      [class_ids],
      ["Resource Not Found"]
    );
    this.dataHandler = instance.handleClassData;
    this.postCheck.push(new CheckFn(instance.haveClassesData, [class_ids]));
  }
}

export class CheckClassUpdatableAndUpdateTask extends Task<ClassType> {
  forward: DynamoDBProcedure<Action<ClassType>>;
  constructor(instance: TaskHandler, payload: ClassUpdatePaylod) {
    super();
    this.forward = new DynamoDBProcedure(
      `Check Class Updatatble ID:${payload.class_id}`,
      classUpdatable,
      [payload],
      ["Resource Not Found", "Conflict"]
    );
    this.dataHandler = instance.handleClassData;
    this.postCheck.push(
      new CheckFn(instance.haveClassData, [payload.class_id])
    );
    this.createEnqueue = (data) => new UpdateClassTask(instance, payload, data);
  }
}

export class UpdateClassTask extends Task<ClassType> {
  forward: DynamoDBProcedure<Action<ClassType>>;
  constructor(
    instance: TaskHandler,
    payload: ClassUpdatePaylod,
    old: ClassType
  ) {
    super();
    this.forward = new DynamoDBProcedure(
      `Update Class ID:${payload.class_id}`,
      updateClass,
      [payload],
      ["Resource Not Found"]
    );
    //add revert
    const { class_id, class_name, available_modules, capacity } = old;
    const { addStudents, addTeachers, removeStudents, removeTeachers } =
      payload;
    const revertPayload: ClassUpdatePaylod = {
      class_id,
      class_name,
      available_modules: Array.from(available_modules ?? new Set()),
      addStudents: removeStudents,
      addTeachers: removeTeachers,
      removeStudents: addStudents,
      removeTeachers: addTeachers,
    };
    this.revertProcedures.push(
      new DynamoDBProcedure(`Revert Update Class ID:${class_id}`, updateClass, [
        revertPayload,
      ])
    );
    this.dataHandler = instance.handleClassData;
    this.postCheck.push(
      new CheckFn(instance.haveClassData, [payload.class_id])
    );
  }
}

export class UpdateTeachersForClassUpdateTask extends Task<RoledUserType[]> {
  forward: Procedure<Action<RoledUserType[]>>;
  constructor(instance: TaskHandler, payload: ClassUpdatePaylod) {
    super();
    instance.setRequireAuht0Token();
    const { class_id, addTeachers, removeTeachers } = payload;
    const teachers = (addTeachers ?? []).concat(removeTeachers ?? []);
    const query: SerachQuery = { email: teachers, type: "OR" };
    this.forward = new Auth0Procedure(
      `Check Teachers For Update Class ID:${class_id}`,
      searchUser,
      [query]
    );
    this.dataHandler = instance.handleUserData;
    this.postCheck.push(
      new CheckFn(instance.haveUsersData, [teachers, "teacher"])
    );
    this.createEnqueue = (users) => {
      const add = users
        .filter((user) => (addTeachers ?? []).includes(user.email))
        .map((user) => {
          const teaching = [
            ...(user.user_metadata?.teaching_class_ids ?? []),
            class_id,
          ];
          return { user, update: { teaching_class_ids: teaching } };
        });
      const remove = users
        .filter((user) => (removeTeachers ?? []).includes(user.email))
        .map((user) => {
          const teaching = (
            user.user_metadata?.teaching_class_ids ?? []
          ).filter((id) => id !== class_id);
          return { user, update: { teaching_class_ids: teaching } };
        });
      return add
        .map((data) => new UpdateUserTask(instance, data.update, data.user))
        .concat(
          remove.map(
            (data) => new UpdateUserTask(instance, data.update, data.user)
          )
        );
    };
  }
}

export class AddStudentsForClassUpdateTask extends Task<RoledUserType[]> {
  forward: Procedure<Action<RoledUserType[]>>;
  constructor(instance: TaskHandler, payload: ClassUpdatePaylod) {
    super();
    instance.setRequireAuht0Token();
    const { class_id, addStudents, removeStudents } = payload;
    const students = (addStudents ?? []).concat(removeStudents ?? []);
    const query: SerachQuery = { email: students, type: "OR" };
    this.forward = new Auth0Procedure(
      `Check Unmanaged Students For Update Class ID:${class_id}`,
      searchUser,
      [query]
    );
    this.dataHandler = instance.handleUserData;
    this.postCheck.push(
      new CheckFn(instance.haveUsersData, [students, "unmanagedStudent"])
    );
    this.createEnqueue = (users) => {
      const add = users
        .filter((user) => (addStudents ?? []).includes(user.email))
        .map((user) => {
          return { user, update: { enrolled_class_id: class_id } };
        });
      return add.map(
        (data) => new UpdateUserTask(instance, data.update, data.user)
      );
    };
  }
}

export class RemoveStudentsForClassUpdateTask extends Task<RoledUserType[]> {
  forward: Procedure<Action<RoledUserType[]>>;
  constructor(instance: TaskHandler, payload: ClassUpdatePaylod) {
    super();
    instance.setRequireAuht0Token();
    const { class_id, addStudents, removeStudents } = payload;
    const students = (addStudents ?? []).concat(removeStudents ?? []);
    const query: SerachQuery = { email: students, type: "OR" };
    this.forward = new Auth0Procedure(
      `Check Managed Students For Update Class ID:${class_id}`,
      searchUser,
      [query]
    );
    this.dataHandler = instance.handleUserData;
    this.postCheck.push(
      new CheckFn(instance.haveUsersData, [students, "managedStudent"])
    );
    this.createEnqueue = (users) => {
      const remove = users
        .filter((user) => (removeStudents ?? []).includes(user.email))
        .map((user) => {
          return { user, update: { enrolled_class_id: null } };
        });
      return remove.map(
        (data) => new UpdateUserTask(instance, data.update, data.user)
      );
    };
  }
}

export class UpdateTeachersForClassDeleteTask extends Task<RoledUserType[]> {
  forward: Procedure<Action<RoledUserType[]>>;
  constructor(instance: TaskHandler, target: ClassType) {
    super();
    instance.setRequireAuht0Token();
    const { class_id, teacher_ids } = target;
    const teachers = Array.from(teacher_ids ?? new Set<string>());
    const query: SerachQuery = { email: teachers, type: "OR" };
    this.forward = new Auth0Procedure(
      `Check Teachers For Delete Class ID:${class_id}`,
      searchUser,
      [query]
    );
    this.dataHandler = instance.handleUserData;
    this.postCheck.push(
      new CheckFn(instance.haveUsersData, [teachers, "teacher"])
    );
    this.createEnqueue = (users) => {
      const remove = users.map((user) => {
        const teaching = (user.user_metadata?.teaching_class_ids ?? []).filter(
          (id) => id !== class_id
        );
        return { user, update: { teaching_class_ids: teaching } };
      });
      return remove.map(
        (data) => new UpdateUserTask(instance, data.update, data.user)
      );
    };
  }
}

export class UpdateStudentsForClassDeleteTask extends Task<RoledUserType[]> {
  forward: Procedure<Action<RoledUserType[]>>;
  constructor(instance: TaskHandler, target: ClassType) {
    super();
    instance.setRequireAuht0Token();
    const { class_id, student_ids } = target;
    const students = Array.from(student_ids ?? new Set<string>());
    const query: SerachQuery = { email: students, type: "OR" };
    this.forward = new Auth0Procedure(
      `Check Students For Delete Class ID:${class_id}`,
      searchUser,
      [query]
    );
    this.dataHandler = instance.handleUserData;
    this.postCheck.push(
      new CheckFn(instance.haveUsersData, [students, "managedStudent"])
    );
    this.createEnqueue = (users) => {
      const remove = users.map((user) => {
        return { user, update: { enrolled_class_id: null } };
      });
      return remove.map(
        (data) => new UpdateUserTask(instance, data.update, data.user)
      );
    };
  }
}

export class DeleteClassTask extends Task<undefined> {
  forward: Procedure<Action<undefined>>;
  constructor(instance: TaskHandler, target: ClassType) {
    super();
    const { class_id, class_name, available_modules, teacher_ids, capacity } =
      target;
    this.forward = new DynamoDBProcedure(
      `Delete Class ID:${target.class_id}`,
      deleteClass,
      [target.class_id]
    );
    const revertPayload: Parameters<typeof createClass>[0] = {
      class_name,
      capacity,
      available_modules: Array.from(available_modules ?? new Set()),
      teacher_ids: Array.from(teacher_ids ?? new Set()),
    };
    this.revertProcedures.push(
      new DynamoDBProcedure(
        `Revert Delete Class ID:${target.class_id}`,
        createClass,
        [revertPayload, class_id]
      )
    );
  }
}

export class DeleteClassByClassIDTask extends Task<ClassType> {
  forward: Procedure<Action<ClassType>>;
  constructor(instance: TaskHandler, class_id: string) {
    super();
    this.forward = new DynamoDBProcedure(
      `Find Class For Delete ID:${class_id}`,
      getClass,
      [class_id],
      ["Resource Not Found"]
    );
    this.dataHandler = instance.handleClassData;
    this.postCheck.push(new CheckFn(instance.haveClassData, [class_id]));
    this.createEnqueue = (data) => {
      const tasks: Task<any>[] = [new DeleteClassTask(instance, data)];
      if (data.student_ids?.size) {
        tasks.unshift(new UpdateStudentsForClassDeleteTask(instance, data));
      }
      if (data.teacher_ids?.size) {
        tasks.unshift(new UpdateTeachersForClassDeleteTask(instance, data));
      }
      return tasks;
    };
  }
}
