import { APIError, ERROR_STATUS_TEXT } from "./api_utils";
import {
  filterObject,
  hasIntersection,
  isSubset,
  removeDuplicates,
  zodErrorMessage,
} from "./utils";
import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { eq, sql, and, like, or, inArray, lt, ne } from "drizzle-orm";
import { PostgresError } from "postgres";
import * as schema from "../../drizzle/schema";
import postgres from "postgres";
import {
  BatchCreateUserPaylaod,
  CreateGroupPayload,
  CreateModulePayload,
  CreateUserPayload,
  GroupUpdatePayload,
  UpdateModulePayload,
  UserUpdate,
  batchGetUsersResSchema,
} from "@/models/api_schemas";
import { Group, GroupType, UserRole, userSchema } from "@/models/db_schemas";
import  * as z from "zod";
import db from "./drizzle_client";

//Use db client from drizzle_client.ts


//* for testing route
export async function test() {
  try {
    return await db.transaction(async (tx) => {
      // return await updateAndCheckGroupsDerivedFields(tx,["f1"],0,true)
      // return await recomputeCompletionNum(tx, ["g1", "c1"]);
      // return await recomputeStudentCount(tx, [
      //   "f1",
      //   "c1",
      //   "3ecb5e46-9914-47b6-ab29-9d56a7ed08a4",
      // ]);
      return await tx.delete(modules);
    });
  } catch (error) {
    throw formatError(error);
  }
}

//!error handle not done

// const db_url = process.env.DATABASE_URL;
// const DB_MAX_CON = 10 as const;

// if (!db_url) throw Error("db url not set");

// // for query purposes
// const queryClient = postgres(db_url, {
//   max: DB_MAX_CON,
//   // ssl: { rejectUnauthorized: false },
// });
// const db = drizzle(queryClient, { schema });


const TRANSACTION_MAX_WAIT = 5000 as const;
const TRANSACTION_TIMEOUT = 10000 as const;

const TRANSCATION_CONFIG = {
  maxWait: TRANSACTION_MAX_WAIT,
  timeout: TRANSACTION_TIMEOUT,
} as const;

const {
  users,
  groupAvailableModules,
  groups,
  userAvailableModules,
  userModuleProgress,
  enrolls,
  manages,
  modules,
} = schema;

function uuid(): string {
  return crypto.randomUUID();
}

const isPostgresError = (error: any): error is PostgresError => {
  return error?.name === "PostgresError";
};

const psqlErrorKey = (error: PostgresError): string => {
  const key =
    error.constraint_name
      ?.split("_")
      .filter((s) => s !== "fkey" && s !== error.table_name && s !== "key")
      .join("_") ?? "unknown_key";
  return key;
};

function formatError(error: any) {
  // console.log("before api",error)
  if (error instanceof APIError) {
    // console.log("is api error")
    return error;
  } else if (isPostgresError(error)) {
    switch (error.code) {
      case "23503":
        // forgein fey failed
        const fkey = psqlErrorKey(error);
        return new APIError(
          "Bad Request",
          `Invalid ${fkey} in ${error.table_name ?? "unknown_table"}`
        );
      case "25P02":
        //transaction closed
        return new APIError("DB Error", "Transaction closed");
      case "23505":
        //unique_violation
        const ukey = psqlErrorKey(error);
        return new APIError(
          "Bad Request",
          `${ukey} already exists in ${error.table_name ?? "unknown_table"}`
        );
      default:
        console.log(error);
        return new APIError("DB Error", error.message);
    }
  } else if(error instanceof z.ZodError){
    return new APIError("DB Error",zodErrorMessage(error.issues))
  }
  else
    return new APIError(
      "Internal Server Error",
      error.message ?? "Unknown Error"
    );
}

class ParallelRunner {
  tasks: Promise<any>[];
  error?: APIError;
  data: any[] = [];

  constructor(tasks: Promise<any>[] = []) {
    this.tasks = tasks;
  }

  addTasks = (...newTasks: Promise<any>[]) => {
    return this.tasks.push(...newTasks);
  };

  seperateResult = (res: PromiseSettledResult<any>[]) => {
    const success = [];
    const rejected = [];
    for (const p of res) {
      if (p.status === "rejected") rejected.push(p);
      else success.push(p);
    }

    return {
      success,
      rejected,
    };
  };

  formaDBErrors = (rejected: PromiseRejectedResult[]) => {
    if (!rejected.length) return undefined;
    const deliminator = "||";
    const messages: string[] = [];
    let status: ERROR_STATUS_TEXT | undefined = undefined;
    for (const problem of rejected) {
      const formated = formatError(problem.reason);
      //do not mention transction error due to paralell
      if (formated.message === "Transaction closed") continue;
      if (!status) status = formated.status;
      messages.push(formated.message);
    }
    return new APIError(status ?? "DB Error", messages.join(deliminator));
  };
  /**
   *
   * @returns void
   * @throw API Error if any rejected res
   */
  run = async () => {
    if (!this.tasks.length) return;
    try {
      const res = await Promise.allSettled(this.tasks);
      const { success, rejected } = this.seperateResult(res);
      this.data = this.data.concat(success.map((s) => s.value));
      this.error = this.formaDBErrors(rejected);
      // console.log(this.tasks)
    } catch (error) {
      this.error = formatError(error);
    }
    // console.log('runner:',this.error,this.error instanceof APIError)
    if (this.error) throw this.error;
  };
}

const sqlNow = sql<string>`NOW()`;

function formatSQLDate(date: Date | undefined | null): string | undefined {
  if (!date) return undefined;
  return date.toISOString();
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];


/**
 * *IMPORTANT: WILL update modified date of group
 * !NOT TESTED WITH ALRGE DATA
 *
 * @param tx transcation context
 * @param groupIds grooup_ids to be recomputed
 * @returns {Promise<string[]>} Array of DISTINCT group_id s updated
 */
export async function recomputeCompletionNum(
  tx: Tx,
  groupIds: string[]
): Promise<string[]> {
  const firstId = groupIds.at(0);
  //asset  len(id) >=1
  if (!firstId) return [];
  const gidCondition =
    groupIds.length === 1
      ? eq(groupAvailableModules.groupId, firstId)
      : inArray(groupAvailableModules.groupId, groupIds);
  //unequal count
  const needUpdates = await tx
    .select({
      groupId: groupAvailableModules.groupId,
      moduleId: groupAvailableModules.moduleId,
      unlocked: groupAvailableModules.unlocked,
      count: sql<number>`CAST(COUNT(*) as INT)`,
    })
    .from(groupAvailableModules)
    .innerJoin(enrolls, eq(enrolls.groupId, groupAvailableModules.groupId))
    .innerJoin(
      userModuleProgress,
      eq(enrolls.userId, userModuleProgress.userId)
    )
    .where(
      and(
        eq(groupAvailableModules.moduleId, userModuleProgress.moduleId),
        eq(userModuleProgress.completed, true),
        gidCondition
      )
    )
    .groupBy(
      groupAvailableModules.groupId,
      groupAvailableModules.moduleId,
      groupAvailableModules.unlocked,
      groupAvailableModules.numberOfCompletion
    )
    .having(({ count }) => ne(count, groupAvailableModules.numberOfCompletion));
  // console.log(needUpdates);
  if (needUpdates.length === 0) return [];
  const values = needUpdates.map((row) => {
    const { count, ...rest } = row;
    return { ...rest, numberOfCompletion: count };
  });
  //updates the completion count
  const upserts = await tx
    .insert(groupAvailableModules)
    .values(values)
    .onConflictDoUpdate({
      target: [groupAvailableModules.groupId, groupAvailableModules.moduleId],
      set: {
        numberOfCompletion: sql`excluded.number_of_completion`,
      },
    })
    .returning();
  const affectedGroupIds = removeDuplicates(upserts.map((p) => p.groupId));
  const upGroups = await tx
    .update(groups)
    .set({ moduleLastModifiedTime: sqlNow })
    .where(inArray(groups.groupId, affectedGroupIds));
  return affectedGroupIds;
}

export async function moduleCompletionNum(
  tx: Tx,
  moduleIds: string[],
  userIds?: string[]
) {
  // console.log("find molulde com num",moduleIds, userIds);
  const fMid = moduleIds.at(0);
  if (!fMid) return [];
  const midCondition =
    moduleIds.length > 1
      ? inArray(userModuleProgress.moduleId, moduleIds)
      : eq(userModuleProgress.moduleId, fMid);

  const fUid = userIds && userIds?.at(0);
  const uidCondition = fUid
    ? userIds.length > 1
      ? inArray(userModuleProgress.userId, userIds)
      : eq(userModuleProgress.userId, fUid)
    : sql`1=1`; //all users

  const rows = await tx
    .select({
      moduleId: userModuleProgress.moduleId,
      count: sql<number>`CAST(COUNT(*) as INT)`,
    })
    .from(userModuleProgress)
    .where(
      and(midCondition, uidCondition, eq(userModuleProgress.completed, true))
    )
    .groupBy(userModuleProgress.moduleId);
  console.log(rows);
  const found = rows.map((f) => f.moduleId);
  const noProgress = moduleIds
    .filter((id) => !found.includes(id))
    .map((moduleId) => ({ moduleId, count: 0 }));
  // if (rows.length !== moduleIds.length)
  //   throw new APIError("Bad Request", "Invalid module_id");
  return rows.concat(noProgress);
}

/**
 * *IMPORTANT: WILL update student modified date of group
 * !NOT TESTED WITH ALRGE DATA
 *
 * @param tx transcation context
 * @param groupIds grooup_ids to be recomputed
 * @returns {Promise<string[]>} Array of DISTINCT group_id s updated
 */
export async function recomputeStudentCount(
  tx: Tx,
  groupIds: string[]
): Promise<string[]> {
  const firstId = groupIds.at(0);
  //asset  len(id) >=1
  if (!firstId) return [];
  const gidCondition =
    groupIds.length === 1
      ? eq(groups.groupId, firstId)
      : inArray(groups.groupId, groupIds);

  //unequal count
  const needUpdates = await tx
    .select({
      groupId: groups.groupId,
      type: groups.type,
      groupName: groups.groupName,
      studentLastModifiedTime: groups.studentLastModifiedTime,
      moduleLastModifiedTime: groups.moduleLastModifiedTime,
      capacity: groups.capacity,
      count: sql<number>`CAST(COUNT(${enrolls.id}) as INT)`,
    })
    .from(groups)
    .leftJoin(enrolls, eq(groups.groupId, enrolls.groupId))
    .where(gidCondition)
    .groupBy(groups.groupId)
    .having(({ count }) => ne(count, groups.studentCount));
  console.log(needUpdates);
  if (needUpdates.length === 0) return [];
  const values = needUpdates.map((row) => {
    const { count, ...rest } = row;
    return { ...rest, studentCount: count };
  });
  //updates the completion count
  const upserts = await tx
    .insert(groups)
    .values(values)
    .onConflictDoUpdate({
      target: [groups.groupId],
      set: {
        studentCount: sql`excluded.student_count`,
        studentLastModifiedTime: sqlNow,
      },
    })
    .returning();
  return upserts.map((u) => u.groupId);
}


/**
 *
 * @param tx
 * @param groupIds
 * @param numberOfEnrolls
 * @returns
 * @throws APIError if groups not managable, messages "Invalid group_id"
 */
async function checkGroupManagable(
  tx: Tx,
  groupIds: string[],
  type: GroupType
): Promise<void> {
  const firstId = groupIds.at(0);
  //len ==0
  if (!firstId) return;
  const gidCondition =
    groupIds.length === 1
      ? eq(groups.groupId, firstId)
      : inArray(groups.groupId, groupIds);
  const found = await tx
    .select()
    .from(groups)
    .where(and(gidCondition, eq(groups.type, type)));
  const groupNumUnmatch = found.length !== groupIds.length;
  if (groupNumUnmatch) throw new APIError("Bad Request", "Invalid group_id");
}


/**
 *
 * @param tx
 * @param groupIds
 * @param deltaScount neg/pos integer, optional
 * @param  updateModules  boolean, optional
 * @returns Group updated
 *
 * @throw APIError with text "Insufficient capcity" if ANY group fail checking BASE ON SCOUNT (cached)
 */
async function updateAndCheckGroupsDerivedFields(
  tx: Tx,
  groupIds: string[],
  deltaScount?: number,
  updateModules?: boolean
) {
  if (deltaScount === 0) deltaScount = undefined;
  const noUpdate = !deltaScount && !updateModules;
  const firstId = groupIds.at(0);
  if (noUpdate || !firstId) return [];
  const gidCondition =
    groupIds.length === 1
      ? eq(groups.groupId, firstId)
      : inArray(groups.groupId, groupIds);
  const now = sqlNow;
  const updated = await tx
    .update(groups)
    .set({
      studentCount: deltaScount
        ? sql`${groups.studentCount} + ${deltaScount}`
        : undefined,
      studentLastModifiedTime: deltaScount ? now : undefined,
      moduleLastModifiedTime: updateModules ? now : undefined,
    })
    .where(gidCondition)
    .returning();
  // console.log(updated,updated.some(group=> group.type==="class" && group.studentCount > group.capacity))
  if (
    updated.some(
      (group) => group.type === "class" && group.studentCount > group.capacity
    )
  ) {
    throw new APIError("Bad Request", "Insufficient capcity");
  }
  return updated;
}
/**
 * should use select insteand if only ONE user
 * @param tx
 * @param userIds
 */
async function enrolledGroupIds(tx: Tx, userIds: string[]) {
  const enrolled = await tx
    .selectDistinctOn([enrolls.groupId], { groupId: enrolls.groupId })
    .from(enrolls)
    .where(inArray(enrolls.userId, userIds));
  return enrolled.map((e) => e.groupId);
}

// CRUD users and user-by-id
export async function createUser(payload: CreateUserPayload) {
  const {
    email,
    name,
    expiration_date,
    role,
    enrolling,
    managing,
    available_modules,
  } = payload;
  try {
    const data = await db.transaction(async (tx) => {
      const isStudent = role === "student";
      const canMange = role === "parent" || role === "teacher";
      const isNormal = role !== "admin";
      //* let fkey to check
      // //check if groups can be enrolled
      // isStudent &&  enrolling?.length && await checkGroupsEnrollable(tx,enrolling,1)
      //check if groups can be managed and in correct type
      canMange &&
        managing?.length &&
        (await checkGroupManagable(
          tx,
          managing,
          role === "parent" ? "family" : "class"
        ));
      // //check if modules can be added
      // isNormal && available_modules?.length && await checkMoudlesAddable(tx,available_modules)
      const rows = await tx
        .insert(users)
        .values({
          name,
          email,
          expirationDate: isNormal ? formatSQLDate(expiration_date) : undefined,
          role,
          userId: uuid(),
        })
        .returning();
      // console.log(rows)
      const user = rows.at(0);
      if (!user) {
        throw new APIError("DB Error", "Us12er Not Inserted");
      }
      const runner = new ParallelRunner();

      if (isStudent && enrolling?.length) {
        const values = enrolling.map((id) => ({
          userId: user.userId,
          groupId: id,
        }));
        // console.log(enrolling)
        runner.addTasks(
          updateAndCheckGroupsDerivedFields(tx, enrolling, 1),
          tx.insert(enrolls).values(values)
        );
      }
      if (canMange && managing?.length) {
        const values = managing.map((id) => ({
          userId: user.userId,
          groupId: id,
        }));
        runner.addTasks(tx.insert(manages).values(values));
      }
      if (isNormal && available_modules?.length) {
        const values = available_modules.map((id) => ({
          userId: user.userId,
          moduleId: id,
        }));
        runner.addTasks(tx.insert(userAvailableModules).values(values));
      }
      await runner.run();
      return userSchema.parse(user);
    });
    return data;
  } catch (error) {
    const err = formatError(error);
    // console.log("create process err", err.message, err instanceof APIError);
    throw err;
  }
}

export async function batchCreateUser(payload: BatchCreateUserPaylaod) {
  const {
    users: usersArray,
    role,
    enrolling,
    managing,
    available_modules,
    expiration_date,
  } = payload;
  const isStudent = role === "student";
  const canMange = role === "parent" || role === "teacher";
  const isNormal = role !== "admin";
  try {
    //check for capacity
    const sqlDate = isNormal ? formatSQLDate(expiration_date) : undefined;
    const data = await db.transaction(async (tx) => {
      const insertValues = usersArray.map((user) => ({
        name: user.name,
        email: user.email,
        expirationDate: sqlDate,
        role,
        userId: uuid(),
      }));
      const res = await tx.insert(users).values(insertValues).returning();
      // const userIds =
      const runner = new ParallelRunner();
      if (isStudent && enrolling?.length) {
        const values = enrolling.flatMap((groupId) =>
          res.flatMap((user) => ({ userId: user.userId, groupId }))
        );
        runner.addTasks(
          updateAndCheckGroupsDerivedFields(tx, enrolling, res.length),
          tx.insert(enrolls).values(values)
        );
      }
      if (canMange && managing?.length) {
        const values = managing.flatMap((groupId) =>
          res.flatMap((user) => ({ userId: user.userId, groupId }))
        );
        runner.addTasks(tx.insert(enrolls).values(values));
      }
      if ((isStudent || canMange) && available_modules?.length) {
        const values = available_modules.flatMap((moduleId) =>
          res.flatMap((user) => ({ userId: user.userId, moduleId }))
        );

        runner.addTasks(tx.insert(userAvailableModules).values(values));
      }
      await runner.run();
      return z.array(userSchema).parse(res);
    });
    return data;
  } catch (error) {
    const err = formatError(error);
    throw err;
  }
}

export async function batchGetUsersByIds(userIds: string[]) {
  try {
    const res = await db
      .select()
      .from(users)
      .where(inArray(users.userId, userIds));
    return res;
  } catch (error) {
    throw formatError(error);
  }
}

export async function batchGetUsersByEmails(emails: string[]) {
  try {
    const res = await db
      .select()
      .from(users)
      .where(inArray(users.email, emails));
    return res;
  } catch (error) {
    throw formatError(error);
  }
}

export async function getUserByEmail(email: string) {
  try {
    const res = await db.select().from(users).where(eq(users.email, email));
    const user = res.at(0);
    if (!user) throw new APIError("Resource Not Found");
    return userSchema.parse(user);
  } catch (error) {
    throw formatError(error);
  }
}

export async function getUserById(userId: string) {
  try {
    const res = await db.select().from(users).where(eq(users.userId, userId));
    const user = res.at(0);
    if (!user) throw new APIError("Resource Not Found");
    return user;
  } catch (error) {
    throw formatError(error);
  }
}

export async function updateUser(email: string, update: UserUpdate) {
  try {
    const res = await db
      .update(users)
      .set({
        name: update.name,
        expirationDate: formatSQLDate(update.expiration_date),
      })
      .where(eq(users.email, email))
      .returning();
    const user = res.at(0);
    if (!user) throw new APIError("Resource Not Found");
    return userSchema.parse(user);
  } catch (error) {
    throw formatError(error);
  }
}

export async function batchUpdateUser(emails: string[], update: Omit<UserUpdate,"name">) {
  try {
    const expirationDate = update.expiration_date
    if(!expirationDate) throw new APIError("Bad Request","expiration_date is required")
    const res = await db
      .update(users)
      .set({
        expirationDate:formatSQLDate(expirationDate),
      })
      .where(inArray(users.email, emails))
      .returning();
    return res;
  } catch (error) {
    throw formatError(error);
  }
}

export async function deleteUserById(userId: string) {
  try {
    const res = await db.transaction(async (tx) => {
      const found = await tx
        .select()
        .from(users)
        .where(eq(users.userId, userId));
      const user = found.at(0);
      if (!user) throw new APIError("Resource Not Found", "Invalid user_id");
      const enrolled =
        user.role === "student"
          ? (
              await tx
                .select()
                .from(enrolls)
                .where(eq(users.userId, user.userId))
            ).map((e) => e.groupId)
          : [];
      await tx.delete(users).where(eq(users.userId, userId));
      const runner = new ParallelRunner();
      if (enrolled.length) {
        runner.addTasks(
          updateAndCheckGroupsDerivedFields(tx, enrolled, -1),
          recomputeCompletionNum(tx, enrolled)
        );
      }
      await runner.run();
      return user;
    });
    return userSchema.parse(res);
  } catch (error) {
    throw formatError(error);
  }
}

export async function deleteUserByEmail(email: string) {
  try {
    const res = await db.transaction(async (tx) => {
      const found = await tx.select().from(users).where(eq(users.email, email));
      const user = found.at(0);
      if (!user) throw new APIError("Resource Not Found", "Invalid user_id");
      const enrolled =
        user.role === "student"
          ? (
              await tx
                .select()
                .from(enrolls)
                .where(eq(enrolls.userId, user.userId))
            ).map((e) => e.groupId)
          : [];
      await tx.delete(users).where(eq(users.userId, user.userId));
      const runner = new ParallelRunner();
      if (enrolled.length) {
        runner.addTasks(
          updateAndCheckGroupsDerivedFields(tx, enrolled, -1),
          recomputeCompletionNum(tx, enrolled)
        );
      }
      await runner.run();
      return user;
    });
    return userSchema.parse(res);
  } catch (error) {
    throw formatError(error);
  }
}

export async function batchDeleteUsers(userIds: string[]) {
  try {
    const data = await db.transaction(async (tx) => {
      //enrolled uid
      const enrolled = await enrolledGroupIds(tx, userIds);
      //perform delete user records and enrolls records
      const rows = await tx
        .delete(users)
        .where(inArray(enrolls.userId, userIds))
        .returning();

      //handle cached fileds
      if (enrolled.length) {
        const runner = new ParallelRunner();
        runner.addTasks(
          recomputeCompletionNum(tx, enrolled),
          recomputeStudentCount(tx, enrolled)
        );
        await runner.run();
      }
      return rows;
    });
    return batchGetUsersResSchema.parse(data);
  } catch (error) {
    throw formatError(error);
  }
}

//CRUD groups

export async function createGroup(payload: CreateGroupPayload) {
  const {
    group_name,
    type,
    manager_emails,
    student_emails,
    capacity,
    available_modules,
    unlocked_modules,
  } = payload;
  const isClass = type === "class";
  const isFamily = type === "family";
  if (isClass && capacity < student_emails.length)
    throw new APIError("Bad Request");
  try {
    const data = await db.transaction(async (tx) => {
      // find userIds for enroll and manage
      const emails = student_emails.concat(manager_emails);
      const students: string[] = [];
      const managers: string[] = [];
      if (emails.length) {
        const rows = await tx
          .select({
            userId: users.userId,
            email: users.email,
            role: users.role,
          })
          .from(users)
          .where(inArray(users.email, emails));
        for (const row of rows) {
          const { email, role, userId } = row;
          if (student_emails.includes(email) && role === "student") {
            students.push(userId);
          } else if (
            manager_emails.includes(email) &&
            (role === "parent" || role === "teacher")
          ) {
            managers.push(userId);
          }
        }
      }
      if (students.length !== student_emails.length)
        throw new APIError("Bad Request", "Invalid student email");
      if (managers.length !== manager_emails.length)
        throw new APIError("Bad Request", "Invalid manager email");
      const groupId = uuid();
      const irows = await tx
        .insert(groups)
        .values({
          groupId,
          type,
          groupName: group_name,
          capacity: isClass ? capacity : -1,
          studentCount: student_emails.length,
        })
        .returning();
      const group = irows.at(0);
      if (!group) throw new APIError("DB Error");
      const runner = new ParallelRunner();
      //enrolls
      if (students.length) {
        const values = students.map((userId) => ({ userId, groupId }));
        runner.addTasks(tx.insert(enrolls).values(values));
      }
      //managers
      if (managers.length) {
        const values = managers.map((userId) => ({ userId, groupId }));
        runner.addTasks(tx.insert(manages).values(values));
      }
      if (available_modules.length) {
        const task = async () => {
          const completedCount = await moduleCompletionNum(
            tx,
            available_modules,
            students
          );
          console.log(completedCount);
          const values = completedCount.map((r) => {
            const { moduleId, count } = r;
            const unlocked = unlocked_modules.includes(moduleId);
            return {
              moduleId,
              groupId,
              unlocked,
              numberOfCompletion: count,
            };
          });
          await tx.insert(groupAvailableModules).values(values);
        };
        runner.addTasks(task());
      }
      await runner.run();
      return group;
    });
    return data;
  } catch (error) {
    throw formatError(error);
  }
}

export async function batchGetGroupsByIds(groupIds: string[]) {
  try {
    const res = await db
      .select()
      .from(groups)
      .where(inArray(groups.groupId, groupIds));
    return res;
  } catch (error) {
    throw formatError(error);
  }
}

export async function batchGetGroupsByGroupNames(groupNames: string[]) {
  try {
    const res = await db
      .select()
      .from(groups)
      .where(inArray(groups.groupName, groupNames));
    return res;
  } catch (error) {
    throw formatError(error);
  }
}

export async function getGroupByGroupName(groupName: string) {
  try {
    const res = await db
      .select()
      .from(groups)
      .where(eq(groups.groupName, groupName));
    const group = res.at(0);
    if (!group) throw new APIError("Resource Not Found");
    return group;
  } catch (error) {
    throw formatError(error);
  }
}

export async function getGroupById(groupId: string) {
  try {
    const res = await db
      .select()
      .from(groups)
      .where(eq(groups.groupId, groupId));
    const group = res.at(0);
    if (!group) throw new APIError("Resource Not Found");
    return group;
  } catch (error) {
    throw formatError(error);
  }
}

export async function updateGroup(groupId: string, update: GroupUpdatePayload) {
  try {
    const rows = await db
      .update(groups)
      .set(update)
      .where(eq(groups.groupId, groupId))
      .returning();
    const group = rows.at(0);
    if (!group) throw new APIError("Resource Not Found", "Invlaid group_id");
    return group;
  } catch (error) {
    throw formatError(error);
  }
}

export async function deleteGroup(groupId: string) {
  try {
    const rows = await db.delete(groups).where(eq(groups.groupId, groupId)).returning();
    const group = rows.at(0);
    if (!group) throw new APIError("Resource Not Found", "Invlaid group_id");
    return group;
  } catch (error) {
    throw formatError(error);
  }
}

//crud user enrolls
export async function createUserEnrolls(email: string, groupIds: string[]) {
  try {
    const data = await db.transaction(async (tx) => {
      const user = (
        await tx.select().from(users).where(eq(users.email, email))
      ).at(0);
      if (!user) throw new APIError("Resource Not Found", "Invlaid email");
      if (user.role !== "student")
        throw new APIError("Bad Request", "User is not student");
      await tx
        .insert(enrolls)
        .values(groupIds.map((groupId) => ({ userId: user.userId, groupId })));
      const runner = new ParallelRunner();
      runner.addTasks(recomputeCompletionNum(tx, groupIds));
      const res = await updateAndCheckGroupsDerivedFields(tx, groupIds, 1);
      await runner.run();
      return res;
    });
    return data;
  } catch (error) {
    throw formatError(error);
  }
}

export async function getEnrolledGroups(email: string) {
  try {
    const data = await db
      .select()
      .from(groups)
      .innerJoin(enrolls, eq(enrolls.groupId, groups.groupId))
      .innerJoin(users, eq(users.userId, enrolls.userId))
      .where(and(eq(users.email, email), eq(users.role, "student")));
    return data.map((d) => d.Groups);
  } catch (error) {
    throw formatError(error);
  }
}

export async function updateUserEnrolls(
  email: string,
  add: string[],
  remove: string[]
) {
  try {
    const data = await db.transaction(async (tx) => {
      const user = (
        await tx.select().from(users).where(eq(users.email, email))
      ).at(0);
      if (!user) throw new APIError("Resource Not Found", "Invlaid email");
      if (user.role !== "student")
        throw new APIError("Bad Request", "User is not student");
      const updates = new ParallelRunner();
      if (add.length) {
        updates.addTasks(
          tx
            .insert(enrolls)
            .values(add.map((groupId) => ({ userId: user.userId, groupId })))
        );
      }
      if (remove.length) {
        updates.addTasks(
          tx
            .delete(enrolls)
            .where(
              and(
                eq(enrolls.userId, user.userId),
                inArray(enrolls.groupId, remove)
              )
            )
        );
      }
      await updates.run();
      const groupIds = add.concat(remove);
      const runner = new ParallelRunner();
      runner.addTasks(
        recomputeCompletionNum(tx, groupIds),
        updateAndCheckGroupsDerivedFields(tx, remove, -1)
      );
      const res = await updateAndCheckGroupsDerivedFields(tx, add, 1);
      await runner.run();
      return res;
    });
    return data;
  } catch (error) {
    throw formatError(error);
  }
}

export async function deleteUserEnrolls(email: string, groupIds: string[]) {
  try {
    const data = await db.transaction(async (tx) => {
      const user = (
        await tx.select().from(users).where(eq(users.email, email))
      ).at(0);
      if (!user) throw new APIError("Resource Not Found", "Invlaid email");
      const del = await tx
        .delete(enrolls)
        .where(
          and(
            eq(enrolls.userId, user.userId),
            inArray(enrolls.groupId, groupIds)
          )
        )
        .returning();
      if (del.length !== groupIds.length)
        throw new APIError(
          "Bad Request",
          "Invlaid group_id or user is not enrolled in all groups"
        );
      const runner = new ParallelRunner();
      runner.addTasks(
        recomputeCompletionNum(tx, groupIds),
        updateAndCheckGroupsDerivedFields(tx, groupIds, -1)
      );
      await runner.run();
      return;
    });
    return data;
  } catch (error) {
    throw formatError(error);
  }
}

//crud group enrolls
export async function createGroupEnrolls(emails: string[], groupId: string) {
  try {
    const femail = emails.at(0);
    if (!femail) return [];
    const emailCon =
      emails.length > 1
        ? inArray(users.email, emails)
        : eq(users.email, femail);
    const data = await db.transaction(async (tx) => {
      const students = await tx.select().from(users).where(emailCon);
      if (students.length !== emails.length)
        throw new APIError("Resource Not Found", "Invlaid email");
      if (students.some((user) => user.role !== "student"))
        throw new APIError("Bad Request", "User is not student");
      await tx
        .insert(enrolls)
        .values(students.map((user) => ({ userId: user.userId, groupId })));
      const runner = new ParallelRunner();
      runner.addTasks(recomputeCompletionNum(tx, [groupId]));
      runner.addTasks(
        updateAndCheckGroupsDerivedFields(tx, [groupId], students.length)
      );
      await runner.run();
      return students;
    });
    return data;
  } catch (error) {
    throw formatError(error);
  }
}

export async function getEnrolledUsers(groupId: string) {
  try {
    const data = await db
      .select()
      .from(groups)
      .innerJoin(enrolls, eq(enrolls.groupId, groups.groupId))
      .innerJoin(users, eq(users.userId, enrolls.userId))
      .where(and(eq(groups.groupId, groupId), eq(users.role, "student")));
    return data.map((d) => d.Users);
  } catch (error) {
    throw formatError(error);
  }
}

export async function updateGroupEnrolls(
  add: string[],
  remove: string[],
  groupId: string
) {
  const emails = add.concat(remove);
  const femail = emails.at(0);
  if (!femail) return [];
  const emailCon =
    emails.length > 1 ? inArray(users.email, emails) : eq(users.email, femail);

  try {
    const data = await db.transaction(async (tx) => {
      const students = await tx.select().from(users).where(emailCon);
      const studentsToAdd = students.filter((user) => add.includes(user.email));
      const studentsToRemove = students.filter((user) =>
        remove.includes(user.email)
      );

      if (studentsToAdd.length !== add.length)
        throw new APIError("Resource Not Found", "Invlaid email");
      if (studentsToAdd.some((user) => user.role !== "student"))
        throw new APIError("Bad Request", "User is not student");

      const updates = new ParallelRunner();
      if (studentsToAdd.length) {
        updates.addTasks(
          tx
            .insert(enrolls)
            .values(
              studentsToAdd.map((user) => ({ userId: user.userId, groupId }))
            )
        );
      }
      if (studentsToRemove.length) {
        updates.addTasks(
          tx.delete(enrolls).where(
            and(
              eq(enrolls.groupId, groupId),
              inArray(
                enrolls.userId,
                studentsToRemove.map((user) => user.userId)
              )
            )
          )
        );
      }
      await updates.run();
      const runner = new ParallelRunner();
      runner.addTasks(recomputeCompletionNum(tx, [groupId]));
      runner.addTasks(recomputeCompletionNum(tx, [groupId]));
      await runner.run();
      return studentsToAdd;
    });
    return data;
  } catch (error) {
    throw formatError(error);
  }
}

export async function deleteGroupEnrolls(emails: string[], groupId: string) {
  const femail = emails.at(0);
  if (!femail) return [];
  const emailCon =
    emails.length > 1 ? inArray(users.email, emails) : eq(users.email, femail);

  try {
    const data = await db.transaction(async (tx) => {
      const students = await tx.select().from(users).where(emailCon);
      if (students.length !== emails.length)
        throw new APIError("Resource Not Found", "Invlaid email");
      if (students.some((user) => user.role !== "student"))
        throw new APIError("Bad Request", "User is not student");
      const uids = students.map((s) => s.userId);
      const fuid = uids.at(0);
      if (!fuid) return;
      const uidCon =
        uids.length > 1
          ? inArray(enrolls.userId, uids)
          : eq(enrolls.userId, fuid);
      const del = await tx
        .delete(enrolls)
        .where(and(uidCon, eq(enrolls.groupId, groupId)))
        .returning();
      if (del.length !== emails.length)
        throw new APIError(
          "Bad Request",
          "Invlaid email or user is not enrolled in all groups"
        );
      const runner = new ParallelRunner();
      runner.addTasks(
        recomputeCompletionNum(tx, [groupId]),
        updateAndCheckGroupsDerivedFields(tx, [groupId], -1)
      );
      await runner.run();
      return;
    });
    return data;
  } catch (error) {
    throw formatError(error);
  }
}

//crud user manages
export async function createUserManages(email: string, groupIds: string[]) {
  const fgid = groupIds.at(0);
  if (!fgid) return [];
  const gidCon =
    groupIds.length > 1
      ? inArray(groups.groupId, groupIds)
      : eq(groups.groupId, fgid);
  try {
    const data = await db.transaction(async (tx) => {
      const user = (
        await tx.select().from(users).where(eq(users.email, email))
      ).at(0);
      if (!user) throw new APIError("Resource Not Found", "Invlaid email");
      const isParent = user.role === "parent";
      const isTeacher = user.role === "teacher";
      if (!isParent && !isTeacher)
        throw new APIError("Bad Request", "User is not teacher/manager");
      const type: GroupType = isParent ? "family" : "class";
      const res = await tx
        .select()
        .from(groups)
        .where(and(gidCon, eq(groups.type, type)));
      if (res.length !== groupIds.length)
        throw new APIError("Bad Request", "Invalid group_id");
      await tx
        .insert(manages)
        .values(groupIds.map((groupId) => ({ userId: user.userId, groupId })));
      return res;
    });
    return data;
  } catch (error) {
    throw formatError(error);
  }
}

export async function getMangedGroups(email: string) {
  try {
    const data = await db
      .select()
      .from(groups)
      .innerJoin(manages, eq(manages.groupId, groups.groupId))
      .innerJoin(users, eq(users.userId, manages.userId))
      .where(and(eq(users.email, email)));
    return data.map((d) => d.Groups);
  } catch (error) {
    throw formatError(error);
  }
}

export async function updateUserManages(
  email: string,
  add: string[],
  remove: string[]
) {
  try {
    const data = await db.transaction(async (tx) => {
      const user = (
        await tx.select().from(users).where(eq(users.email, email))
      ).at(0);
      if (!user) throw new APIError("Resource Not Found", "Invlaid email");
      const isParent = user.role === "parent";
      const isTeacher = user.role === "teacher";
      if (!isParent && !isTeacher)
        throw new APIError("Bad Request", "User is not teacher/manager");
      const type: GroupType = isParent ? "family" : "class";
      const fAddId = add.at(0);
      const addCon = fAddId
        ? add.length > 1
          ? inArray(groups.groupId, add)
          : eq(groups.groupId, fAddId)
        : undefined;
      const toAdd = add.at(0)
        ? await tx
            .select()
            .from(groups)
            .where(and(addCon, eq(groups.type, type)))
        : [];
      if (toAdd.length !== add.length)
        throw new APIError("Bad Request", "Invalid group_id");
      const updates = new ParallelRunner();
      if (toAdd.length) {
        updates.addTasks(
          tx
            .insert(enrolls)
            .values(add.map((groupId) => ({ userId: user.userId, groupId })))
        );
      }
      if (remove.length) {
        updates.addTasks(
          tx
            .delete(enrolls)
            .where(
              and(
                eq(enrolls.userId, user.userId),
                inArray(enrolls.groupId, remove)
              )
            )
        );
      }
      await updates.run();
      return toAdd;
    });
    return data;
  } catch (error) {
    throw formatError(error);
  }
}

export async function deleteUserManages(email: string, groupIds: string[]) {
  try {
    const data = await db.transaction(async (tx) => {
      const user = (
        await tx.select().from(users).where(eq(users.email, email))
      ).at(0);
      if (!user) throw new APIError("Resource Not Found", "Invlaid email");
      const del = await tx
        .delete(manages)
        .where(
          and(
            eq(manages.userId, user.userId),
            inArray(manages.groupId, groupIds)
          )
        )
        .returning();
      if (del.length !== groupIds.length)
        throw new APIError(
          "Bad Request",
          "Invlaid group_id or user is not managing in all groups"
        );
      return;
    });
    return data;
  } catch (error) {
    throw formatError(error);
  }
}

//crud group manages
export async function createGroupManages(emails: string[], groupId: string) {
  try {
    const femail = emails.at(0);
    if (!femail) return [];
    const emailCon =
      emails.length > 1
        ? inArray(users.email, emails)
        : eq(users.email, femail);
    const data = await db.transaction(async (tx) => {
      const tar = (
        await tx.select().from(groups).where(eq(groups.groupId, groupId))
      ).at(0);
      if (!tar) throw new APIError("Resource Not Found", "Invalid group_id");
      const isClass = tar.type === "class";
      const isFam = tar.type === "family";
      const role = isClass ? "teacher" : ("parent" satisfies UserRole);
      const managers = await tx.select().from(users).where(and(emailCon));
      if (managers.length !== emails.length)
        throw new APIError("Resource Not Found", "Invlaid email");
      if (managers.some((user) => user.role !== role))
        throw new APIError("Bad Request", "User is not manager");
      await tx
        .insert(manages)
        .values(managers.map((user) => ({ userId: user.userId, groupId })));
      return managers;
    });
    return data;
  } catch (error) {
    throw formatError(error);
  }
}

export async function getManagedUsers(groupId: string) {
  try {
    const data = await db
      .select()
      .from(groups)
      .innerJoin(manages, eq(manages.groupId, groups.groupId))
      .innerJoin(users, eq(users.userId, manages.userId))
      .where(
        and(
          eq(groups.groupId, groupId),
          or(eq(users.role, "parent"), eq(users.role, "teacher"))
        )
      );
    return data.map((d) => d.Users);
  } catch (error) {
    throw formatError(error);
  }
}

export async function updateGroupManages(
  add: string[],
  remove: string[],
  groupId: string
) {
  const emails = add.concat(remove);
  const femail = emails.at(0);
  if (!femail) return [];
  const emailCon =
    emails.length > 1 ? inArray(users.email, emails) : eq(users.email, femail);

  try {
    const data = await db.transaction(async (tx) => {
      const tar = (
        await tx.select().from(groups).where(eq(groups.groupId, groupId))
      ).at(0);
      if (!tar) throw new APIError("Resource Not Found", "Invalid group_id");
      const isClass = tar.type === "class";
      const isFam = tar.type === "family";
      const role = isClass ? "teacher" : ("parent" satisfies UserRole);

      const managers = await tx.select().from(users).where(emailCon);
      const managersToAdd = managers.filter((user) => add.includes(user.email));
      const managersToRemove = managers.filter((user) =>
        remove.includes(user.email)
      );

      if (managersToAdd.length !== add.length)
        throw new APIError("Resource Not Found", "Invlaid email");
      if (managersToAdd.some((user) => user.role !== role))
        throw new APIError("Bad Request", "User is not manager");

      const updates = new ParallelRunner();
      if (managersToAdd.length) {
        updates.addTasks(
          tx
            .insert(manages)
            .values(
              managersToAdd.map((user) => ({ userId: user.userId, groupId }))
            )
        );
      }
      if (managersToRemove.length) {
        updates.addTasks(
          tx.delete(manages).where(
            and(
              eq(manages.groupId, groupId),
              inArray(
                manages.userId,
                managersToRemove.map((user) => user.userId)
              )
            )
          )
        );
      }
      await updates.run();

      return managersToAdd;
    });
    return data;
  } catch (error) {
    throw formatError(error);
  }
}

export async function deleteGroupManages(emails: string[], groupId: string) {
  const femail = emails.at(0);
  if (!femail) return [];
  const emailCon =
    emails.length > 1 ? inArray(users.email, emails) : eq(users.email, femail);

  try {
    const data = await db.transaction(async (tx) => {
      const tar = (
        await tx.select().from(groups).where(eq(groups.groupId, groupId))
      ).at(0);
      if (!tar) throw new APIError("Resource Not Found", "Invalid group_id");
      const isClass = tar.type === "class";
      const isFam = tar.type === "family";
      const role = isClass ? "teacher" : ("parent" satisfies UserRole);
      const managers = await tx.select().from(users).where(emailCon);
      if (managers.length !== emails.length)
        throw new APIError("Resource Not Found", "Invlaid email");
      if (managers.some((user) => user.role !== role))
        throw new APIError("Bad Request", "User is not manager");
      const uids = managers.map((s) => s.userId);
      const fuid = uids.at(0);
      if (!fuid) return;
      const uidCon =
        uids.length > 1
          ? inArray(manages.userId, uids)
          : eq(manages.userId, fuid);
      const del = await tx
        .delete(manages)
        .where(and(uidCon, eq(manages.groupId, groupId)))
        .returning();
      if (del.length !== emails.length)
        throw new APIError(
          "Bad Request",
          "Invlaid email or user is not managing in all groups"
        );
      return;
    });
    return data;
  } catch (error) {
    throw formatError(error);
  }
}

//crud module

export async function createModule(payload: CreateModulePayload) {
  const { module_name } = payload;
  const moduleId = uuid();
  try {
    const res = await db
      .insert(modules)
      .values({ moduleId, moduleName: module_name })
      .returning();
    const data = res.at(0);
    if (!data) throw new APIError("DB Error");
    return data;
  } catch (error) {
    throw formatError(error);
  }
}

export async function getModule(moduleIds: string[]) {
  const fid = moduleIds.at(0);
  const conditon = fid
    ? moduleIds.length > 1
      ? inArray(modules.moduleId, moduleIds)
      : eq(modules.moduleId, fid)
    : sql`1=1`;
  try {
    const res = await db.select().from(modules).where(conditon);
    return res;
  } catch (error) {
    throw formatError(error);
  }
}

export async function updateModule(payload: UpdateModulePayload) {
  const { module_name, module_id } = payload;
  try {
    const res = await db
      .update(modules)
      .set({ moduleName: module_name })
      .where(eq(modules.moduleId, module_id))
      .returning();
    const data = res.at(0);
    if (!data) throw new APIError("DB Error");
    return data;
  } catch (error) {
    throw formatError(error);
  }
}

export async function deleteModule(moduleId: string) {
  try {
    const res = await db
      .delete(modules)
      .where(eq(modules.moduleId, moduleId))
      .returning();
    const data = res.at(0);
    if (!data) throw new APIError("DB Error");
    return data;
  } catch (error) {
    throw formatError(error);
  }
}

//crud user modules

//list of module id
export async function getUserAvaibleModules(email: string) {
  try {
    const res = await db
      .select()
      .from(userAvailableModules)
      .innerJoin(users, eq(users.userId, userAvailableModules.userId))
      .where(eq(users.email, email));
    return res.map((r) => r.UserAvailableModules.moduleId);
  } catch (error) {
    throw formatError(error);
  }
}

export async function updateUserAvailableModules(
  email: string,
  add: string[],
  remove: string[]
) {
  try {
    const data = await db.transaction(async (tx) => {
      const userRows = await tx
        .select()
        .from(users)
        .where(eq(users.email, email));
      const user = userRows.at(0);
      if (!user) throw new APIError("Resource Not Found", "Invalid email");
      const added = add.length
        ? await tx
            .insert(userAvailableModules)
            .values(add.map((moduleId) => ({ moduleId, userId: user.userId })))
            .returning()
        : [];
      const frid = remove.at(0);
      if (frid) {
        const condition =
          remove.length > 1
            ? inArray(userAvailableModules.moduleId, remove)
            : eq(userAvailableModules.moduleId, frid);
        await tx
          .delete(userAvailableModules)
          .where(and(eq(userAvailableModules.userId, user.userId), condition));
      }
      return added.map((m) => m.moduleId);
    });
    return data;
  } catch (error) {
    throw formatError(error);
  }
}

//ru group Modules

export async function getGroupAvailableModules(groupId:string) {
  try {
    const res = await db
      .select()
      .from(groupAvailableModules)
      .where(eq(groupAvailableModules.groupId,groupId));
    const data = res.map(row=>{
      const {groupId,id,...rest} = row
      return rest
    })
    return data
  } catch (error) {
    throw formatError(error);
  }
  
}

/**
 * new Modules default to be locked
 * @param groupId
 * @param add
 * @param remove
 * @param lock
 * @param unlock
 * @returns
 */
export async function updateGroupAvailbaleModules(
  groupId: string,
  add: string[],
  remove: string[],
  lock: string[],
  unlock: string[]
) {
  try {
    const data = await db.transaction(async (tx) => {
      const runner = new ParallelRunner();
      const justLock = lock.filter((id) => !add.includes(id));
      const justUnLock = unlock.filter((id) => !add.includes(id));
      runner.addTasks(
        updateAndCheckGroupsDerivedFields(tx, [groupId], undefined, true)
      );
      if (justLock.length) {
        runner.addTasks(
          tx
            .update(groupAvailableModules)
            .set({ unlocked: false })
            .where(
              and(
                eq(groupAvailableModules.groupId, groupId),
                inArray(groupAvailableModules.moduleId, justLock)
              )
            )
        );
      }
      if (justUnLock.length) {
        runner.addTasks(
          tx
            .update(groupAvailableModules)
            .set({ unlocked: true })
            .where(
              and(
                eq(groupAvailableModules.groupId, groupId),
                inArray(groupAvailableModules.moduleId, justUnLock)
              )
            )
        );
      }
      if (remove.length) {
        runner.addTasks(
          tx.delete(groupAvailableModules).where(
            and(
              eq(groupAvailableModules.groupId, groupId),
              inArray(groupAvailableModules.moduleId, remove)
            )
          )
        )
      }
      const completCount = await moduleCompletionNum(tx, [groupId], add);
      //modules are default to be locked

      const added = add.length?  await tx
        .insert(groupAvailableModules)
        .values(
          add.map((moduleId) => ({
            moduleId,
            groupId,
            unlocked: unlock.includes(moduleId),
          }))
        )
        .returning():[];
      await runner.run()
      const data = added.map(row=>{
        const {groupId,id,...rest} = row
        return rest
      })
      return data
    });
    return data;
  } catch (error) {
    throw formatError(error);
  }
}
