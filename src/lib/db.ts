import { GroupType, UserRole, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma_client";
import { APIError, ERROR_STATUS_TEXT } from "./api_utils";
import { filterObject, hasIntersection, isSubset } from "./utils";
import { allRoles, allGroupsTypes, moduleSchema } from "@/models/db_schemas";
import {
  User as PopoulatedUser,
  Group as PopulatedGroup,
  userSchema,
  groupSchema,
} from "@/models/db_schemas";
import { DefaultArgs } from "@prisma/client/runtime/library";


const TRANSACTION_MAX_WAIT = 5000 as const 
const TRANSACTION_TIMEOUT = 10000 as const 

const TRANSCATION_CONFIG ={
  maxWait:TRANSACTION_MAX_WAIT,
  timeout:TRANSACTION_TIMEOUT
} as const 


const errorCode = {
  "Unique Constraint Failed": "P2002",
  "Required Record Not Found": "P2025",
} as const;

type DBError = typeof errorCode;
type ErrorCause = keyof DBError;
type ErrorCode = DBError[ErrorCause];

type ExpectedError = {
  [K in ErrorCause]?: { status: ERROR_STATUS_TEXT; message?: string };
};

function handleDBError(error: any, expectedError?: ExpectedError) {
  if (error instanceof APIError) return error;
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    !expectedError
  ) {
    return new APIError("DB Error", error.message ?? "Unknown");
  }
  const code = error.code;
  const expectedCauses = Object.keys(expectedError) as ErrorCause[];
  for (const cause of expectedCauses) {
    const corrispondingCode = errorCode[cause];
    const obj = expectedError[cause];
    if (code === corrispondingCode && obj) {
      const { status, message } = obj;
      return new APIError(status, message ?? cause ?? "Unkown");
    }
  }
  return new APIError("DB Error", error.message ?? "Unknown");
}

const expectedError: ExpectedError = {
  "Required Record Not Found": { status: "Bad Request" },
};

const userInculde = {
  Enroll: {
    select: { group_id: true },
  },
  Manages: {
    select: { group_id: true },
  },
  Families: {
    select: { group_id: true },
  },
  StudentAvailableModules: {
    select: { module_id: true },
  },
};

const groupInclude = {
  Manages: {
    select: { user_id: true },
  },
  Enrolls: {
    select: { user_id: true },
  },
  Families: { select: { user_id: true } },
  GroupAvailableModules: {
    select: { module_id: true, unlocked: true },
  },
};

function populateUser(
  user: Prisma.UsersGetPayload<{
    include: {
      Enroll: {
        select: { group_id: true };
      };
      Manages: {
        select: { group_id: true };
      };
      Families: {
        select: { group_id: true };
      };
      StudentAvailableModules: {
        select: { module_id: true };
      };
    };
  }>
) {
  const result = {
    ...user,
    enrolled: user.Enroll?.group_id,
    managing: user.Manages.map((manage) => manage.group_id),
    families: user.Families.map((fam) => fam.group_id),
    available_modules: user.StudentAvailableModules.map((m) => m.module_id),
  };
  // console.log(user,result)
  return userSchema.parse(result);
}

function populateGroup(
  data: Prisma.GroupsGetPayload<{
    include: {
      Manages: {
        select: { user_id: true };
      };
      Enrolls: {
        select: { user_id: true };
      };
      Families: { select: { user_id: true } };
      GroupAvailableModules: {
        select: { module_id: true; unlocked: true };
      };
    };
  }>
) {
  const result = {
    ...data,
    managers: data.Manages.map((manage) => manage.user_id),
    students: data.Enrolls.map((enroll) => enroll.user_id),
    children: data.Families.map((fam) => fam.user_id),
    available_modules: data.GroupAvailableModules.map((m) => m.module_id),
    unlocked_modules: data.GroupAvailableModules
      .filter((m) => m.unlocked)
      .map((x) => x.module_id),
  };
  // console.log(data,result)
  return groupSchema.parse(result);
}

function populateModule(data: Prisma.ModulesGetPayload<{}>) {
  const result = {
    ...data,
  };
  // console.log(data,result)
  return moduleSchema.parse(result);
}

//email must be exact
async function findUserByTx(
  tx: Omit<
    PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
  >,
  email: string[]
): Promise<PopoulatedUser[]>;
async function findUserByTx(
  tx: Omit<
    PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
  >,
  email: string
): Promise<PopoulatedUser>;
async function findUserByTx(
  tx: Omit<
    PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
  >,
  email: string | string[]
): Promise<PopoulatedUser[] | PopoulatedUser> {
  if (Array.isArray(email)) {
    const users = await tx.users.findMany({
      where: {
        email: {
          in: email,
        },
      },
      include: userInculde,
    });
    if (users.length !== email.length) {
      throw new APIError("Resource Not Found", "Users not found");
    }
    return users.map((user) => populateUser(user));
  } else {
    const user = await tx.users.findUnique({
      where: {
        email,
      },
      include: userInculde,
    });
    if (!user) {
      throw new APIError("Resource Not Found", "User not found");
    }
    return populateUser(user);
  }
}

//group_ids must be exact
async function findGroupByTx(
  tx: Omit<
    PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
  >,
  group_id: string
): Promise<PopulatedGroup>;
async function findGroupByTx(
  tx: Omit<
    PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
  >,
  group_id: string[]
): Promise<PopulatedGroup[]>;
async function findGroupByTx(
  tx: Omit<
    PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
  >,
  group_id: string | string[]
): Promise<PopulatedGroup | PopulatedGroup[]> {
  if (Array.isArray(group_id)) {
    const groups = await tx.groups.findMany({
      where: {
        group_id: {
          in: group_id,
        },
      },
      include: groupInclude,
    });
    if (groups.length !== group_id.length) {
      throw new APIError("Resource Not Found", "Groups not found");
    }
    return groups.map(populateGroup);
  } else {
    const group = await tx.groups.findUnique({
      where: {
        group_id,
      },
      include: groupInclude,
    });
    if (!group) {
      throw new APIError("Resource Not Found", "Group not found");
    }
    return populateGroup(group);
  }
}

async function updateGroupAttr(
  tx: Omit<
    PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
  >,
  group_id: string,
  change: {
    scount_update?:number,
    modify_module?:boolean,
  }
) {
  const {scount_update,modify_module = false} = change
  if(!scount_update&&!modify_module) return
  try {
    const updated = await tx.groups.update({
      where: {
        group_id,
      },
      data: {
        student_count: scount_update?{
          increment: scount_update,
        }:undefined,
        module_last_modified_time: modify_module?new Date():undefined,
        student_last_modified_time:scount_update?new Date():undefined
      },
    });
    return;
  } catch (error) {
    throw handleDBError(error, {
      "Required Record Not Found": {
        status: "Resource Not Found",
        message: "Invalid group_id",
      },
    });
  }
}

async function updateGroupsAttr(
  tx: Omit<
    PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
  >,
  group_ids: string[],
  change: {
    scount_update?:number,
    modify_module?:boolean,
  }
) {
  const {scount_update,modify_module = false} = change
  if(!scount_update&&!modify_module) return
  if (!group_ids.length) return;
  if (group_ids.length === 1) {
    if (!group_ids[0]) return;
    await updateGroupAttr(tx, group_ids[0], change);
    return;
  }
  try {
    const updated = await tx.groups.updateMany({
      where: {
        group_id: {
          in: group_ids,
        },
      },
      data: {
        student_count: scount_update?{
          increment: scount_update,
        }:undefined,
        module_last_modified_time: modify_module?new Date():undefined,
        student_last_modified_time:scount_update?new Date():undefined
      },
    });
    return;
  } catch (error) {
    throw handleDBError(error, {});
  }
}

type SubCreateUserPayloadByRole =
  | {
      role: "admin";
      expiration_date?: null;
      available_modules?: null;
      enrolled?: null;
      managing?: null;
      families?: null;
    }
  | {
      role: "student";
      enrolled?: string;
      expiration_date: Date;
      available_modules?: string[];
      managing?: null;
      families: string[];
    }
  | {
      role: "teacher" | "parent";
      expiration_date: Date;
      available_modules?: null;
      enrolled?: null;
      managing: string[];
      families?: null;
    };

export type CreateUserPayload = {
  email: string;
  name: string;
} & SubCreateUserPayloadByRole;

export async function createUser(payload: CreateUserPayload) {
  const {
    email,
    name,
    available_modules,
    enrolled,
    expiration_date,
    role,
    managing,
    families,
  } = payload;
  const canManage = role === "teacher" || role === "parent";
  const isStudent = role === "student";
  const haveExpiration = role !== "admin";
  const modules = isStudent ? available_modules ?? [] : [];
  if (enrolled && isStudent) {
    await checkClassEnrollabe(enrolled, 1);
  }
  if (managing && managing.length && canManage) {
    const type: GroupType[] =
      role === "teacher" ? ["class"] : role === "parent" ? ["family"] : [];
    await findManyGroups({ group_ids: managing, exact: true, type });
  }
  if (isStudent && families && families.length) {
    await findManyGroups({
      group_ids: families,
      exact: true,
      type: ["family"],
    });
  }
  // console.log(modules);
  try {
    const data = await prisma.$transaction(async (tx) => {
      const groupsToUpdateCount = [
        ...(isStudent && families ? families : []),
        ...(canManage && managing ? managing : []),
      ];
      isStudent && enrolled && groupsToUpdateCount.push(enrolled);
      const deltaCount = isStudent ? 1 : 0;
      const user = await tx.users.create({
        data: {
          email,
          name,
          StudentAvailableModules: modules.length
            ? {
                createMany: {
                  data: modules.map((id) => ({ module_id: id })),
                },
              }
            : undefined,
          role,
          expiration_date: haveExpiration ? expiration_date : undefined,
          Enroll:
            enrolled && isStudent
              ? {
                  create: { group_id: enrolled },
                }
              : undefined,
          Manages:
            managing && canManage
              ? {
                  createMany: {
                    data: managing.map((group_id) => ({ group_id })),
                  },
                }
              : undefined,
          Families:
            families && isStudent
              ? {
                  createMany: {
                    data: families.map((id) => ({ group_id: id })),
                  },
                }
              : undefined,
        },
        include: userInculde,
      });
      const updateCount = await updateGroupsAttr(
        tx,
        groupsToUpdateCount,
        {
          scount_update:deltaCount
        }
      );
      return user;
    },TRANSCATION_CONFIG);

    // console.log(data);
    const result = populateUser(data);
    return result;
  } catch (error) {
    throw handleDBError(error, {
      "Required Record Not Found": {
        status: "Resource Not Found",
        message: "Groups OR Modules Not Found",
      },
      "Unique Constraint Failed": {
        status: "Conflict",
        message: `${email} already exist in DB`,
      },
    });
  }
}

type createManyUserPayload = {
  users: { name: string; email: string }[];
} & SubCreateUserPayloadByRole;

export async function batchCreateUsers(
  payload: createManyUserPayload
): Promise<PopoulatedUser[]> {
  const {
    users,
    available_modules,
    enrolled,
    expiration_date,
    role,
    managing,
    families,
  } = payload;
  //check enrollable
  const isStudent = role === "student";
  const willEnroll = role === "student" && enrolled;
  const willManage =
    (role === "teacher" || role === "parent") && managing && managing.length;
  const willFamily = isStudent && families && families.length;
  const haveExpiration = role !== "admin";
  const modules = isStudent && available_modules ? available_modules : [];
  const emails = users.map((user) => user.email);
  if (willEnroll) {
    await checkClassEnrollabe(enrolled, users.length);
  }
  if (willManage) {
    const type: GroupType[] =
      role === "teacher" ? ["class"] : role === "parent" ? ["family"] : [];
    await findManyGroups({ group_ids: managing, exact: true, type });
  }
  if (willFamily) {
    await findManyGroups({
      group_ids: families,
      exact: true,
      type: ["family"],
    });
  }
  const usersData = users.map(({ email, name }) => ({
    email,
    name,
    role,
    expiration_date: haveExpiration ? expiration_date : undefined,
  }));
  // console.log(usersData)
  // console.log("modules:",modules)
  try {
    const data = await prisma.$transaction(async (tx) => {
      const groupsToUpdateCount = [
        ...(isStudent && families ? families : []),
        ...(willManage ? managing : []),
      ];
      isStudent && enrolled && groupsToUpdateCount.push(enrolled);
      const deltaCount = isStudent ? users.length : 0;
      await tx.users.createMany({
        data: usersData,
      });
      if (willEnroll || willManage || willFamily) {
        const users = await findUserByTx(tx, emails);
        if (!Array.isArray(users)) throw new Error("Not finding user array");
        if (willEnroll) {
          await tx.enrolls.createMany({
            data: users.map((user) => ({
              user_id: user.user_id,
              group_id: enrolled,
            })),
          });
        }
        if (willManage) {
          await tx.manages.createMany({
            data: users.flatMap((user) =>
              managing.map((group_id) => ({
                group_id,
                user_id: user.user_id,
              }))
            ),
          });
        }
        if (willFamily) {
          await tx.families.createMany({
            data: users.flatMap((user) =>
              families.map((group_id) => ({ group_id, user_id: user.user_id }))
            ),
          });
        }
        if (modules.length) {
          const { count } = await tx.studentAvailableModules.createMany({
            data: users.flatMap((user) =>
              modules.map((module_id) => ({
                module_id,
                user_id: user.user_id,
              }))
            ),
          });
          // console.log(count)
        }
        const upCount = await updateGroupsAttr(
          tx,
          groupsToUpdateCount,
          {
            scount_update:deltaCount
          }
        );
      }
      return await findUserByTx(tx, emails);
    },TRANSCATION_CONFIG);
    if (!Array.isArray(data)) throw new Error("Not finding user array");
    return data;
  } catch (error) {
    throw handleDBError(error, {
      "Required Record Not Found": {
        status: "Resource Not Found",
        message: "Groups or modules not exists.",
      },
      "Unique Constraint Failed": {
        status: "Conflict",
        message: `Some users in ${emails.join(", ")} already exist.`,
      },
    });
  }
}

export async function findUserById(user_id: string[], roles?: UserRole[]) {
  const rolesToInculde = roles ?? allRoles; // allRoles;
  // console.log(roles)
  if (user_id.length > 1) {
    const user = await prisma.users.findMany({
      where: {
        user_id: {
          in: user_id,
        },
        role: {
          in: rolesToInculde,
        },
      },
      include: userInculde,
    });
    return user.map(populateUser);
  } else if (user_id.length === 1) {
    const id = user_id[0];
    const user = await prisma.users.findUnique({
      where: {
        user_id: id,
        role: {
          in: rolesToInculde,
        },
      },
      include: userInculde,
    });
    // console.log(user)
    if (!user)
      throw new APIError(
        "Resource Not Found",
        `There is no valid ${
          roles ? roles.join("/") : "user"
        } with user_id: ${user_id}.`
      );
    const result = [populateUser(user)];
    return result;
  } else {
    const user = await prisma.users.findMany({
      where: {
        role: {
          in: rolesToInculde,
        },
      },
      include: userInculde,
    });
    return user.map(populateUser);
  }
}

export async function findSingleUser(email: string, roles?: UserRole[]) {
  const rolesToInculde = roles ?? allRoles; // allRoles;
  // console.log(roles)
  const user = await prisma.users.findUnique({
    where: {
      email,
      role: {
        in: rolesToInculde,
      },
    },
    include: userInculde,
  });
  // console.log(user)
  if (!user)
    throw new APIError(
      "Resource Not Found",
      `${email} is not a valid ${roles ? roles.join("/") : "user"}.`
    );
  const result = populateUser(user);
  return result;
}

interface UserQuery {
  email?: string[];
  user_id?: string[];
  roles?: UserRole[];
  exact?: boolean;
}

export async function findManyUsers(query: UserQuery) {
  const { email, roles, exact, user_id } = query;
  // console.log(query)
  const emailsToSearch = email ?? [];
  const userIdToSearch = user_id ?? [];
  const rolesToInculde = roles ?? allRoles;
  if (!emailsToSearch.length && !userIdToSearch) {
    const users = await prisma.users.findMany({
      where: {
        role: {
          in: rolesToInculde,
        },
      },
      include: userInculde,
    });
    return users.map(populateUser);
  }
  const users = await prisma.users.findMany({
    where: {
      OR: [
        {
          email: {
            in: email ?? [],
          },
        },
        {
          user_id: {
            in: user_id ?? [],
          },
        },
      ],
      role: {
        in: rolesToInculde,
      },
    },
    include: userInculde,
  });
  //   console.log(mismatch)
  if (exact) {
    const foundEmail: string[] = [];
    const foundUserId: string[] = [];
    users.forEach((user) => {
      foundEmail.push(user.email);
      foundUserId.push(user.user_id);
    });
    const missingEmail = (email ?? []).filter(
      (email) => !foundEmail.includes(email)
    );
    const missingUserId = (user_id ?? []).filter(
      (id) => !foundUserId.includes(id)
    );
    if (missingEmail.length && missingUserId.length) {
      throw new APIError(
        "Resource Not Found",
        `Email:${missingEmail.join(", ")} and user_id: ${missingUserId.join(
          ", "
        )} are not valid ${roles?.join("/") ?? "user"}s.`
      );
    } else if (missingEmail.length) {
      throw new APIError(
        "Resource Not Found",
        `Email:${missingEmail.join(", ")} are not valid ${
          roles?.join("/") ?? "user"
        }s.`
      );
    } else if (missingUserId.length) {
      throw new APIError(
        "Resource Not Found",
        `user_id: ${missingUserId.join(", ")} are not valid ${
          roles?.join("/") ?? "user"
        }s.`
      );
    }
  }
  const result: PopoulatedUser[] = users.map((user) => populateUser(user));
  return result;
}

interface UserUpdate {
  name?: string;
  expiration_date?: Date;
}

export async function updateUser(email: string, update: UserUpdate) {
  const filetred = filterObject(update, (key, val) => val !== undefined);
  if (Object.keys(filetred).length === 0)
    throw new APIError("Bad Request", "Empty Update");
  const rolesConstrient: UserRole[] = update.expiration_date
    ? allRoles.filter((role) => role !== "admin")
    : allRoles;
  // const users = await findSingleUser(email,rolesConstrient)
  try {
    const data = await prisma.users.update({
      where: {
        email,
        role: {
          in: rolesConstrient,
        },
      },
      data: filetred,
      include: userInculde,
    });
    return populateUser(data);
  } catch (error) {
    throw handleDBError(error, {
      "Required Record Not Found": {
        status: "Resource Not Found",
        message: `${email} is not a valid ${
          rolesConstrient.length === allRoles.length
            ? "user"
            : rolesConstrient.join("/")
        }`,
      },
    });
  }
}

//name is not batch updated
type BatchUserUpdate = Omit<UserUpdate, "name">;

export async function batchUpdateUser(
  emails: string[],
  update: BatchUserUpdate
) {
  const filetred = filterObject(update, (key, val) => val !== undefined);
  if (Object.keys(filetred).length === 0)
    throw new APIError("Bad Request", "Empty Update");
  const rolesConstrient: UserRole[] = update.expiration_date
    ? allRoles.filter((role) => role !== "admin")
    : allRoles;

  const users = await findManyUsers({
    email: emails,
    exact: true,
    roles: rolesConstrient,
  });
  try {
    const data = await prisma.$transaction(async (tx) => {
      const data = await tx.users.updateMany({
        where: {
          email: {
            in: emails,
          },
          role: {
            in: rolesConstrient,
          },
        },
        data: filetred,
      });
      // console.log(data,rolesConstrient)
      if (data.count !== emails.length)
        throw new APIError("DB Error", `Only updated ${data.count} users.`);
      return await findUserByTx(tx, emails);
    },TRANSCATION_CONFIG);
    return data;
  } catch (error) {
    throw handleDBError(error, {
      "Required Record Not Found": {
        status: "Resource Not Found",
        message: `${emails} are not a valid ${
          rolesConstrient.length === allRoles.length
            ? "user"
            : rolesConstrient.join("/")
        }s`,
      },
    });
  }
}

export async function deleteUser(email: string) {
  try {
    const data = await prisma.$transaction(async (tx) => {
      const user = await prisma.users.delete({
        where: {
          email,
        },
        include: userInculde,
      });
      const res = populateUser(user);
      if(res.role ==="student"){
        const ids = [...res.families];
        res.enrolled && ids.push(res.enrolled);
        const upCount = await updateGroupsAttr(
          tx,
          ids,
          {
            scount_update:-1
          }
        );
      }
      return res;
    },TRANSCATION_CONFIG);
    return data;
  } catch (error) {
    throw handleDBError(error, {
      "Required Record Not Found": {
        status: "Resource Not Found",
        message: `${email} is not a valid user`,
      },
    });
  }
}

export async function deleteManyUser(emails: string[], exact: boolean = true) {
  try {
    const { count } = await prisma.$transaction(async (tx) => {
      const users = await tx.users.findMany({
        where: {
          email: {
            in: emails,
          },
        },
        include: {
          Enroll: {
            select: {
              group_id: true,
            },
          },
          Families: {
            select: {
              group_id: true,
            },
          },
          Manages: {
            select: {
              group_id: true,
            },
          },
        },
      });
      if (exact && users.length !== emails.length) {
        throw new APIError(
          "Bad Request",
          `Some users in ${emails.join(", ")} are not valid or not deletable `
        );
      }
      //id->changes(shd be -ve in this func)
      const countToUpdate = new Map<string, number>();
      for (const user of users) {
        if (user.role !== "student") continue;
        const enrolled = user.Enroll?.group_id;
        if (enrolled) {
          const prev = countToUpdate.get(enrolled) ?? 0;
          countToUpdate.set(enrolled, prev - 1);
        }
        for (const fam of user.Families) {
          const prevVal = countToUpdate.get(fam.group_id) ?? 0;
          countToUpdate.set(fam.group_id, prevVal - 1);
        }
      }
      const data = await tx.users.deleteMany({
        where: {
          email: {
            in: emails,
          },
        },
      });
      if (exact && data.count !== emails.length) {
        throw new APIError(
          "Bad Request",
          `Some users in ${emails.join(", ")} are not valid or not deletable `
        );
      }
      for (const [id, delta] of countToUpdate) {
        await updateGroupAttr(tx, id, {
          scount_update:delta
        });
      }
      return data;
    },TRANSCATION_CONFIG);
    return undefined;
  } catch (error) {
    throw handleDBError(error, {
      "Required Record Not Found": {
        status: "Resource Not Found",
        message: `${emails.join(", ")} is not a valid user`,
      },
    });
  }
}

type CreateGroupPayload = {
  group_name: string;
  manager_emails: string[];
} & (
  | {
      type: "class";
      available_modules: string[];
      unlocked_modules: string[];
      student_emails: string[];
      children_emails?: null;
      capacity: number;
    }
  | {
      type: "family";
      available_modules?: null;
      unlocked_modules?: null;
      student_emails?: null;
      children_emails: string[];
      capacity?: null;
    }
);

export async function createGroup(payload: CreateGroupPayload) {
  try {
    const {
      group_name,
      available_modules,
      unlocked_modules,
      type,
      manager_emails,
      student_emails,
      children_emails,
      capacity,
    } = payload;
    if (student_emails && student_emails.length > capacity) {
      throw new APIError("Conflict", "Exceed capacity");
    }
    const isClass = type === "class";
    const isFamily = type === "family";
    const available =
      type === "class" && available_modules ? available_modules : [];
    const unlocked =
      type === "class" && unlocked_modules ? unlocked_modules : [];
    if (!isSubset(available, unlocked)) {
      throw new APIError(
        "Bad Request",
        `Unlocked modules:${unlocked.join(
          ","
        )} is not subset of available modules: ${available.join(",")}`
      );
    }
    const managers = manager_emails
      ? await findManyUsers({
          email: manager_emails,
          roles: isFamily ? ["parent"] : isClass ? ["teacher"] : [],
          exact: true,
        })
      : [];
    const students =
      isClass && student_emails
        ? await findManyUsers({
            email: student_emails,
            roles: ["student"],
            exact: true,
          })
        : [];
    const haveEnrolled = students.filter((user) => user.enrolled);
    if (haveEnrolled.length) {
      throw new APIError(
        "Conflict",
        `${haveEnrolled
          .map((user) => user.email)
          .join(", ")} have already enrolled in classes`
      );
    }
    const children =
      isFamily && children_emails
        ? await findManyUsers({
            email: children_emails,
            exact: true,
            roles: ["student"],
          })
        : [];
    try {
      const data = await prisma.groups.create({
        data: {
          group_name,
          type,
          capacity: capacity ?? -1,
          student_count: isClass
            ? students.length
            : isFamily
            ? children.length
            : 0,
          GroupAvailableModules: {
            createMany: {
              data: available.map((module_id) => ({
                module_id,
                unlocked: unlocked.includes(module_id),
              })),
            },
          },
          Manages:managers.length? {
            createMany: {
              data: managers.map((user) => ({ user_id: user.user_id })),
            },
          }:undefined,
          Enrolls: students.length && isClass?{
            createMany: {
              data: students.map((user) => ({ user_id: user.user_id })),
            },
          }:undefined,
          Families:children.length && isFamily? {
            createMany: {
              data: children.map((user) => ({ user_id: user.user_id })),
            },
          }:undefined,
        },
        include: groupInclude,
      });
      return populateGroup(data);
    } catch (error) {
      throw handleDBError(error, {
        "Required Record Not Found": {
          status: "Resource Not Found",
          message: "Users or modules not exist",
        },
        "Unique Constraint Failed": {
          status: "Conflict",
          message: `${group_name} is an existing group`,
        },
      });
    }
  } catch (error) {
    if (error instanceof APIError && error.status === "Resource Not Found") {
      throw new APIError("Invalid Request Body", error.message);
    }
    throw error;
  }
}

export async function findSingleGroup(group_id: string, type?: GroupType[]) {
  const targetedTypes = type ?? allGroupsTypes;
  const data = await prisma.groups.findUnique({
    where: {
      group_id,
      type: {
        in: targetedTypes,
      },
    },
    include: groupInclude,
  });
  if (!data)
    throw new APIError(
      "Resource Not Found",
      `${group_id} is not a valid ${type ? type.join("/") : "group"}.`
    );
  return populateGroup(data);
}

interface GroupQuery {
  group_ids?: string[];
  type?: GroupType[];
  exact?: boolean;
}

export async function findManyGroups(query: GroupQuery) {
  const { group_ids, type, exact } = query;
  const targetedTypes = type ?? allGroupsTypes;
  if (!group_ids) {
    const data = await prisma.groups.findMany({
      where: {
        type: {
          in: targetedTypes,
        },
      },
      include: groupInclude,
    });
    return data.map(populateGroup);
  }
  const data = await prisma.groups.findMany({
    where: {
      group_id: {
        in: group_ids,
      },
      type: {
        in: targetedTypes,
      },
    },
    include: groupInclude,
  });
  // console.group(data)
  if (exact) {
    const present = data.map((e) => e.group_id);
    const missing = group_ids.filter((id) => !present.includes(id));
    if (missing.length) {
      throw new APIError(
        "Resource Not Found",
        `${missing.join(", ")} are not valid ${
          type ? type.join("/") : "group"
        }s.`
      );
    }
  }

  return data.map(populateGroup);
}

export async function findGroupByName(name: string, type?: GroupType[]) {
  const targetedTypes = type ?? allGroupsTypes;
  const data = await prisma.groups.findUnique({
    where: {
      group_name: name,
      type: {
        in: targetedTypes,
      },
    },
    include: groupInclude,
  });
  if (!data)
    throw new APIError(
      "Resource Not Found",
      `${name} is not a valid ${type ? type.join("/") : "group"} name.`
    );
  return populateGroup(data);
}

type GroupUpdate = {
  group_name?: string;
  capacity?: number;
};

export async function updateGroup(group_id: string, update: GroupUpdate) {
  const filtered = filterObject(update, (key, val) => val !== undefined);
  if (Object.keys(filtered).length === 0)
    throw new APIError("Bad Request", "Invalid Update");
  const { group_name, capacity } = update;
  const where: any = { group_id };
  if (capacity) {
    where.type = "class";
    if (capacity) {
      const target = await findSingleGroup(group_id, ["class"]);
      if (target.students.length > capacity)
        throw new APIError(
          "Bad Request",
          "Updated Capacity exceed existing enrollments."
        );
    }
  }
  try {
    const data = await prisma.groups.update({
      where: where,
      data: {
        ...filtered,
      },
      include: groupInclude,
    });
    return populateGroup(data);
  } catch (error) {
    throw handleDBError(error, {
      "Required Record Not Found": {
        status: "Resource Not Found",
        message: `${group_id} is not a valid ${
          (where.type as string) ?? "group"
        }`,
      },
    });
  }
}

export async function deleteGroup(group_id: string) {
  try {
    const data = await prisma.groups.delete({
      where: { group_id },
      include: groupInclude,
    });
    return populateGroup(data);
  } catch (error) {
    throw handleDBError(error, {
      "Required Record Not Found": {
        status: "Resource Not Found",
        message: `${group_id} is not a valdi group`,
      },
    });
  }
}

async function checkClassEnrollabe(group_id: string, studentNumber: number) {
  const group = await prisma.groups.findFirst({
    where: {
      group_id,
      type: "class",
    },
  });
  if (!group) throw new APIError("Not Found", "Invlaid class id.");
  if (group.capacity - group.student_count < studentNumber) {
    throw new APIError("Conflict", "Targeted class has not enough capacity.");
  }
  return group;
}

export async function enrollUser(email: string, group_id: string) {
  try {
    const { group, user } = await prisma.$transaction(async (tx) => {
      const group = await checkClassEnrollabe(group_id, 1);
      const user = await tx.users.update({
        where: {
          email,
          role: "student",
          Enroll: null,
        },
        data: {
          Enroll: {
            create: { group_id },
          },
        },
        include: userInculde,
      });
      const updScount = await updateGroupAttr(tx, group_id, {
        scount_update:1
      });
      // throw new Error("test");
      return { user, group };
    },TRANSCATION_CONFIG);
    // console.log(user);
    return populateUser(user);
  } catch (error) {
    throw handleDBError(error, {
      "Required Record Not Found": {
        status: "Resource Not Found",
        message: `${email} is not a valid  student with no enrolled class.`,
      },
      "Unique Constraint Failed": {
        status: "Conflict",
        message: `${email} already enrolled in ${group_id}`,
      },
    });
  }
}

export async function disEnrollUser(email: string, group_id: string) {
  try {
    const data = await prisma.$transaction(async (tx) => {
      const user = await tx.users.findUnique({
        where: {
          email,
          role: "student",
          Enroll: {
            isNot: null,
          },
        },
      });
      if (!user) {
        throw new APIError(
          "Resource Not Found",
          `${email} is not a valid  student with no enrolled class.`
        );
      }
      const data = await tx.enrolls.delete({
        where: { user_id: user.user_id, group_id },
      });
      const updScount = await updateGroupAttr(tx, group_id, {
        scount_update:-1
      });

      return await findUserByTx(tx, email);
    },TRANSCATION_CONFIG);
    return data;
  } catch (error) {
    throw handleDBError(error, {
      "Required Record Not Found": {
        status: "Resource Not Found",
        message: `${email} has not enrolled in ${group_id}, or user is not a valid managed student.`,
      },
    });
  }
}

export async function changeClass(email: string, group_id: string) {
  try {
    const data = await prisma.$transaction(async (tx) => {
      await checkClassEnrollabe(group_id, 1);
      const user = await findSingleUser(email, ["student"]);
      const del = await tx.enrolls.delete({
        where: {
          user_id: user.user_id,
        },
      });
      const newEnroll = await tx.enrolls.create({
        data: {
          user_id: user.user_id,
          group_id,
        },
        include: {
          User: {
            include: userInculde,
          },
        },
      });
      const inScount = await updateGroupAttr(tx, del.group_id, {
        scount_update:-1
      });
      const deScount = await updateGroupAttr(tx, newEnroll.group_id, {
        scount_update:1
      });
      return newEnroll.User;
    },TRANSCATION_CONFIG);
    return populateUser(data);
  } catch (error) {
    throw handleDBError(error, {
      "Required Record Not Found": {
        status: "Resource Not Found",
        message: `${email} has not enroled in any class.`,
      },
    });
  }
}


export async function manageUser(email: string, group_ids: string[]) {
  const { user_id, role } = await findSingleUser(email, ["parent", "teacher"]);
  const type: GroupType[] =
    role === "parent" ? ["family"] : role === "teacher" ? ["class"] : [];
  const groups = await findManyGroups({ group_ids, exact: true, type });
  try {
    const user = await prisma.$transaction(async (tx) => {
      const data = await tx.manages.createMany({
        data: group_ids.map((group_id) => ({ group_id, user_id: user_id })),
      });
      return await findUserByTx(tx, email);
    },TRANSCATION_CONFIG);
    return user;
  } catch (error) {
    throw handleDBError(error, {
      "Required Record Not Found": {
        status: "Resource Not Found",
        message: `Groups or users not found.`,
      },
      "Unique Constraint Failed": {
        status: "Conflict",
        message: `${email} already managing some groups in ${group_ids.join(
          ", "
        )}`,
      },
    });
  }
}

export async function unmanageUser(email: string, group_ids: string[]) {
  const data = await prisma.$transaction(async (tx) => {
    const { user_id } = await findSingleUser(email, ["parent", "teacher"]);
    await tx.manages.deleteMany({
      where: {
        user_id,
        group_id: {
          in: group_ids,
        },
      },
    });
    return await findUserByTx(tx, email);
  },TRANSCATION_CONFIG);
  return data;
}

/**
 * first add the remove
 *
 * @param email email of user
 * @param toAdd group_id
 * @param toRemove group_id
 * @returns
 */
export async function updateManage(
  email: string,
  toAdd: string[],
  toRemove: string[]
) {
  try {
    const user = await prisma.$transaction(async (tx) => {
      const { user_id: user_id, role } = await findSingleUser(email, [
        "parent",
        "teacher",
      ]);
      const type: GroupType[] =
        role === "parent" ? ["family"] : role === "teacher" ? ["class"] : [];
      const groups = await findManyGroups({
        group_ids: toAdd,
        exact: true,
        type,
      });
      if (toAdd.length) {
        await tx.manages.createMany({
          data: toAdd.map((group_id) => ({ group_id, user_id })),
        });
      }
      if (toRemove.length) {
        await tx.manages.deleteMany({
          where: {
            user_id,
            group_id: {
              in: toRemove,
            },
          },
        });
      }
      return await findUserByTx(tx, email);
    },TRANSCATION_CONFIG);
    return user;
  } catch (error) {
    throw handleDBError(error, {
      "Required Record Not Found": {
        status: "Resource Not Found",
        message: `Groups or users not found.`,
      },
      "Unique Constraint Failed": {
        status: "Conflict",
        message: `${email} already managing some groups in ${toAdd.join(", ")}`,
      },
    });
  }
}

export async function addStudentToFamily(email: string, group_ids: string[]) {
  try {
    const data = await prisma.$transaction(async (tx) => {
      const { user_id } = await findSingleUser(email, ["student"]);
      const group = findManyGroups({
        group_ids,
        exact: true,
        type: ["family"],
      });
      const { count } = await tx.families.createMany({
        data: group_ids.map((group_id) => ({ group_id, user_id })),
      });
      const updScount = await updateGroupsAttr(tx, group_ids, {
        scount_update:1
      });
      return await findUserByTx(tx, email);
    },TRANSCATION_CONFIG);
    // console.log(data)
    return data;
  } catch (error) {
    throw handleDBError(error, {
      "Unique Constraint Failed": {
        status: "Conflict",
        message: `${email} has already in some families of ${group_ids.join(
          ", "
        )}`,
      },
    });
  }
}

export async function removeStudentFromFamily(
  email: string,
  group_ids: string[]
) {
  const data = await prisma.$transaction(async (tx) => {
    const { user_id } = await findSingleUser(email, ["student"]);
    await tx.families.deleteMany({
      where: {
        user_id,
        group_id: {
          in: group_ids,
        },
      },
    });
    const updScount = await updateGroupsAttr(tx, group_ids, {
      scount_update:-1
    });
    return await findUserByTx(tx, email);
  },TRANSCATION_CONFIG);
  return data;
}

export async function updateFamily(
  email: string,
  toAdd: string[],
  toRemove: string[]
) {
  try {
    const user = await prisma.$transaction(async (tx) => {
      const { user_id, role } = await findSingleUser(email, ["student"]);
      const groups = await findManyGroups({
        group_ids: toAdd,
        exact: true,
        type: ["family"],
      });
      await tx.families.createMany({
        data: toAdd.map((group_id) => ({ group_id, user_id })),
      });
      await tx.families.deleteMany({
        where: {
          user_id,
          group_id: {
            in: toRemove,
          },
        },
      });
      const indScount = await updateGroupsAttr(tx, toAdd, {
        scount_update:1
      });
      const dedScount = await updateGroupsAttr(tx, toRemove, {
        scount_update:-1
      });
      return await findUserByTx(tx, email);
    },TRANSCATION_CONFIG);
    return user;
  } catch (error) {
    throw handleDBError(error, {
      "Required Record Not Found": {
        status: "Resource Not Found",
        message: `Groups or users not found.`,
      },
      "Unique Constraint Failed": {
        status: "Conflict",
        message: `${email} already in some families of ${toAdd.join(", ")}`,
      },
    });
  }
}

interface CreateModulePayload {
  module_name: string;
}

export async function createModule(payload: CreateModulePayload) {
  const { module_name } = payload;
  try {
    const data = await prisma.modules.create({
      data: {
        module_name,
      },
    });
    return populateModule(data);
  } catch (error) {
    throw handleDBError(error, {
      "Unique Constraint Failed": {
        status: "Conflict",
        message: `Module with name:${module_name} exists`,
      },
    });
  }
}

export async function getModules(ids?: string[], exact: boolean = true) {
  if (ids && ids.length > 0) {
    if (ids.length > 1) {
      const data = await prisma.modules.findMany({
        where: {
          module_id: {
            in: ids,
          },
        },
      });
      if (ids.length !== data.length) {
        const missing = ids.filter(
          (id) => !data.map((m) => m.module_id).includes(id)
        );
        if (missing.length)
          throw new APIError(
            "Resource Not Found",
            `${missing} are not valid moudules`
          );
      }
      return data.map(populateModule);
    } else {
      const id = ids[0];
      const data = await prisma.modules.findUnique({
        where: {
          module_id: id,
        },
      });
      if (exact && !data) {
        throw new APIError("Resource Not Found", `${id} is not valid moudule`);
      }
      if (data) {
        return [populateModule(data)];
      } else {
        return [];
      }
    }
  } else {
    const data = await prisma.modules.findMany();
    return data.map(populateModule);
  }
}

interface ModuleUpdate {
  module_name?: string;
}

export async function updateModule(module_id: string, update: ModuleUpdate) {
  const filtered = filterObject(update, (key, val) => val !== undefined);
  if (!Object.keys(filtered).length) {
    throw new APIError("Bad Request", "At least one update to module");
  }
  try {
    const module = await prisma.modules.update({
      where: {
        module_id,
      },
      data: filtered,
    });
    return populateModule(module);
  } catch (error) {
    throw handleDBError(error, {
      "Required Record Not Found": {
        status: "Resource Not Found",
        message: "Invalid module_id",
      },
    });
  }
}

export async function deleteModule(module_id: string) {
  try {
    const data = await prisma.$transaction(async(tx)=>{
      const module = await prisma.modules.delete({
        where: {
          module_id,
        },
        include:{
          GroupAvailableModules:{
            select:{
              group_id:true
            }
          }
        }
      });
      const groudIds = module.GroupAvailableModules.map(r=>r.group_id)
      await tx.groups.updateMany({
        where:{
          group_id:{
            in:groudIds
          }
        },
        data:{
          module_last_modified_time:new Date()
        }
      })
      return module
    },TRANSCATION_CONFIG)
    return populateModule(data);
  } catch (error) {
    throw handleDBError(error, {
      "Required Record Not Found": {
        status: "Resource Not Found",
        message: "Invalid module_id",
      },
    });
  }
}

export async function addAvalibleModulesToStudent(
  email: string,
  module_ids: string[]
) {
  try {
    const user = await findSingleUser(email, ["student"]);
    const data = await prisma.$transaction(async (tx) => {
      await tx.studentAvailableModules.createMany({
        data: module_ids.map((module_id) => ({
          module_id,
          user_id: user.user_id,
        })),
      });
      return await findUserByTx(tx, email);
    },TRANSCATION_CONFIG);
    return data;
  } catch (error) {
    throw handleDBError(error, {
      "Unique Constraint Failed": {
        status: "Conflict",
        message: `user already have this module.`,
      },
      "Required Record Not Found": {
        status: "Resource Not Found",
        message: "Module does not exist",
      },
    });
  }
}

export async function removeAvalibleModulesToStudent(
  email: string,
  module_ids: string[]
) {
  try {
    const user = await findSingleUser(email, ["student"]);
    const data = await prisma.$transaction(async (tx) => {
      const { count } = await tx.studentAvailableModules.deleteMany({
        where: {
          user_id: user.user_id,
          module_id: {
            in: module_ids,
          },
        },
      });
      if (count !== module_ids.length) {
        throw new APIError(
          "Resource Not Found",
          "Some module ids are not valid in available modules of user"
        );
      }

      return await findUserByTx(tx, email);
    },TRANSCATION_CONFIG);
    return data;
  } catch (error) {
    throw handleDBError(error, {
      "Required Record Not Found": {
        status: "Resource Not Found",
        message: "Module does not exist",
      },
    });
  }
}

export async function updateSudentAvailableModules(
  email: string,
  toAdd: string[],
  toRemove: string[]
) {
  try {
    if (hasIntersection(toAdd, toRemove)) {
      throw new APIError(
        "Bad Request",
        `There is intersection between toAdd:${toAdd} and toRemove:${toRemove}`
      );
    }
    const user = await prisma.$transaction(async (tx) => {
      const { user_id, role } = await findSingleUser(email, ["student"]);
      if (toAdd.length) {
        await tx.studentAvailableModules.createMany({
          data: toAdd.map((module_id) => ({ module_id, user_id })),
        });
      }
      if (toRemove.length) {
        await tx.studentAvailableModules.deleteMany({
          where: {
            user_id,
            module_id: {
              in: toRemove,
            },
          },
        });
      }
      return await findUserByTx(tx, email);
    },TRANSCATION_CONFIG);
    return user;
  } catch (error) {
    throw handleDBError(error, {
      "Required Record Not Found": {
        status: "Resource Not Found",
        message: `Modules  not found.`,
      },
      "Unique Constraint Failed": {
        status: "Conflict",
        message: `${email} already have some modules of ${toAdd.join(", ")}`,
      },
    });
  }
}

export async function addAvalibleModulesToClass(
  group_id: string,
  available_module_ids: string[],
  unlocked_modules_ids: string[]
) {
  try {
    if (!isSubset(available_module_ids, unlocked_modules_ids)) {
      throw new APIError(
        "Bad Request",
        `Unlocked modules:${unlocked_modules_ids.join(
          ","
        )} is not subset of available modules: ${available_module_ids.join(
          ","
        )}`
      );
    }
    const group = await findSingleGroup(group_id, ["class"]);
    const data = await prisma.$transaction(async (tx) => {
      const { count } = await tx.groupAvailableModules.createMany({
        data: available_module_ids.map((module_id) => ({
          module_id,
          group_id,
          unlocked: unlocked_modules_ids.includes(module_id),
        })),
      });
      await updateGroupAttr(tx,group_id,{
        modify_module:true
      })
      return await findGroupByTx(tx, group_id);
    },TRANSCATION_CONFIG);
    return data;
  } catch (error) {
    throw handleDBError(error, {
      "Unique Constraint Failed": {
        status: "Conflict",
        message: `Class already have this module.`,
      },
      "Required Record Not Found": {
        status: "Resource Not Found",
        message: "Module does not exist",
      },
    });
  }
}

export async function removeAvalibleModulesToClass(
  group_id: string,
  module_ids: string[]
) {
  try {
    const group = await findSingleGroup(group_id, ["class"]);
    const data = await prisma.$transaction(async (tx) => {
      const { count } = await tx.groupAvailableModules.deleteMany({
        where: {
          group_id: group.group_id,
          module_id: {
            in: module_ids,
          },
        },
      });
      if (count !== module_ids.length) {
        throw new APIError(
          "Resource Not Found",
          "Some module ids are not valid in available modules of group"
        );
      }
      await updateGroupAttr(tx,group_id,{
        modify_module:true
      })
      return await findGroupByTx(tx, group_id);
    },TRANSCATION_CONFIG);
    return data;
  } catch (error) {
    throw handleDBError(error, {
      "Required Record Not Found": {
        status: "Resource Not Found",
        message: "Module does not exist",
      },
    });
  }
}

export async function updateClassAvailableModules(
  group_id: string,
  toAdd: string[],
  toRemove: string[],
  toLock: string[],
  toUnlock: string[]
) {
  try {
    if (hasIntersection(toAdd, toRemove)) {
      throw new APIError(
        "Bad Request",
        `There is intersection between toAdd:${toAdd} and toRemove:${toRemove}`
      );
    }
    if (hasIntersection(toLock, toUnlock)) {
      throw new APIError(
        "Bad Request",
        `There is intersection between toLock:${toLock} and toUnlock:${toUnlock}`
      );
    }
    const group = await findSingleGroup(group_id, ["class"]);
    const locked = group.available_modules.filter(
      (id) => !group.unlocked_modules.includes(id)
    );
    //ids to unlock in the original module set
    const unlock_ids = toUnlock.filter((id) => locked.includes(id));
    //ids to lock in the original module set
    const lock_ids = toLock.filter((id) => group.unlocked_modules.includes(id));
    const data = await prisma.$transaction(async (tx) => {
      const { count: createCount } = await tx.groupAvailableModules.createMany(
        {
          data: toAdd.map((id) => ({
            group_id,
            module_id: id,
            unlocked: toUnlock.includes(id),
          })),
        }
      );
      const { count: deleteCount } = await tx.groupAvailableModules.deleteMany(
        {
          where: {
            group_id,
            module_id: {
              in: toRemove,
            },
          },
        }
      );
      const { count: unlockCount } = await tx.groupAvailableModules.updateMany(
        {
          where: {
            group_id,
            module_id: {
              in: unlock_ids,
            },
          },
          data: {
            unlocked: true,
          },
        }
      );
      const { count: lockCount } = await tx.groupAvailableModules.updateMany({
        where: {
          group_id,
          module_id: {
            in: lock_ids,
          },
        },
        data: {
          unlocked: false,
        },
      });
      await updateGroupAttr(tx,group_id,{
        modify_module:true
      })
      return await findGroupByTx(tx, group_id);
    },TRANSCATION_CONFIG);
    return data;
  } catch (error) {
    throw handleDBError(error, {
      "Required Record Not Found": {
        status: "Resource Not Found",
        message: `Modules  not found.`,
      },
      "Unique Constraint Failed": {
        status: "Conflict",
        message: `${group_id} already have some modules of ${toAdd.join(", ")}`,
      },
    });
  }
}

export async function batchEnroll(emails: string[], group_id: string) {
  try {
    const data = await prisma.$transaction(async (tx) => {
      const group = await tx.groups.findUnique({
        where: {
          group_id,
          type: "class",
        },
        include: {
          Enrolls: {
            select: {
              user_id: true,
            },
          },
        },
      });
      if (!group) throw new APIError("Not Found", "Invlaid class id.");
      if (group.capacity - group.Enrolls.length < emails.length) {
        throw new APIError(
          "Conflict",
          "Targeted class has not enough capacity."
        );
      }
      const students = await findManyUsers({
        email: emails,
        exact: true,
        roles: ["student"],
      });
      const enrolled = students.filter((user) => user.enrolled);
      if (enrolled.length) {
        throw new APIError(
          "Resource Not Found",
          `${enrolled
            .map((user) => user.email)
            .join(", ")} are not  valid students with no enrolled class.`
        );
      }
      const ids = students.map((u) => u.user_id);
      if (
        hasIntersection(
          group.Enrolls.map((r) => r.user_id),
          ids
        )
      ) {
        throw new APIError(
          "Bad Request",
          `There is intersection between current enrolled students and requested users`
        );
      }
      const enrolls = await tx.enrolls.createMany({
        data: ids.map((user_id) => ({ user_id, group_id })),
      });
      const upCount = await updateGroupAttr(tx, group_id, {
        scount_update:ids.length
      });
      return await findGroupByTx(tx, group_id);
    },TRANSCATION_CONFIG);
    return data;
  } catch (error) {
    throw handleDBError(error, {
      "Required Record Not Found": {
        status: "Resource Not Found",
        message: `${emails.join(", ")} are not valid unenrolled students.`,
      },
      "Unique Constraint Failed": {
        status: "Conflict",
        message: `Some users in ${emails.join(
          ", "
        )} already enrolled in ${group_id}`,
      },
    });
  }
}

export async function batchAddFamily(emails: string[], group_id: string) {
  try {
    const data = await prisma.$transaction(async (tx) => {
      const group = await findSingleGroup(group_id, ["family"]);
      const students = await findManyUsers({
        email: emails,
        exact: true,
        roles: ["student"],
      });
      const ids = students.map((u) => u.user_id);
      if (hasIntersection(group.children, ids)) {
        throw new APIError(
          "Bad Request",
          `There is intersection between current children and requested users`
        );
      }
      const families = await tx.families.createMany({
        data: ids.map((user_id) => ({ user_id, group_id })),
      });
      const upCount = await updateGroupAttr(tx, group_id, {
        scount_update:ids.length
      });
      return await findGroupByTx(tx, group_id);
    },TRANSCATION_CONFIG);
    return data;
  } catch (error) {
    throw handleDBError(error, {
      "Required Record Not Found": {
        status: "Resource Not Found",
        message: `${emails.join(", ")} are not valid  students.`,
      },
      "Unique Constraint Failed": {
        status: "Conflict",
        message: `Some users in ${emails.join(", ")} already  in ${group_id}`,
      },
    });
  }
}

export async function batchManage(emails: string[], group_id: string) {
  try {
    const data = await prisma.$transaction(async (tx) => {
      const group = await findSingleGroup(group_id);
      const { type } = group;
      const role: UserRole =
        type === "class" ? "teacher" : type === "family" ? "parent" : "teacher";
      const managers = await findManyUsers({
        email: emails,
        exact: true,
        roles: [role],
      });
      const ids = managers.map((m) => m.user_id);
      if (hasIntersection(group.managers, ids)) {
        throw new APIError(
          "Bad Request",
          `There is intersection between current ${role}s and requested users`
        );
      }
      const manages = await tx.manages.createMany({
        data: ids.map((user_id) => ({ user_id, group_id })),
      });
      return await findGroupByTx(tx, group_id);
    },TRANSCATION_CONFIG);
    return data;
  } catch (error) {
    throw handleDBError(error, {
      "Required Record Not Found": {
        status: "Resource Not Found",
        message: `${emails.join(", ")} are not valid parent/teacher.`,
      },
      "Unique Constraint Failed": {
        status: "Conflict",
        message: `Some users in ${emails.join(
          ", "
        )} already managing in ${group_id}`,
      },
    });
  }
}
