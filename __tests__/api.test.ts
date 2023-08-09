import {
  APIError,
  ERROR_STATUS_TEXT,
  ServerErrorHandler,
} from "@/lib/api_utils";
import { Action, Data, TaskHandler } from "../src/lib/task-handler";
import { delay, futureDate, parseDateStr, sameList } from "@/lib/utils";
import {
  DBProcedure,
  GetAuthTokenProcedure,
  Procedure,
  Task,
} from "@/lib/task-and-procedure";
import { GroupType, UserRole } from "@prisma/client";
import { putLogEvent } from "@/lib/cloud_watch";
import { createGroup, createModule, createUser, deleteGroup, deleteModule, deleteUser, findGroupByName, findManyGroups, findManyUsers, findSingleGroup, findSingleUser, getModules, updateClassAvailableModules } from "@/lib/db";
import { PostGroupsReq, PutClassesModulesReq, postBatchCreateUsersReqSchema, postUsersReqSchema, putUsersReqSchema } from "@/models/api_schemas";
import { deleteAuth0Account, getAccessToken, getAuth0UserByEmail } from "@/lib/auth0_user_management";

const TIME_OUT = 1 * 60 * 1000; //time out limit for each test

const TEST_DATA = {
  emails: [
    "aiblocks_test_one@gmail.com",
    "aiblocks_test_two@gmail.com",
    "aiblocks_test_three@gmail.com",
  ],
  module_names:["TEST MODULE 1","TEST MODULE 2","TEST MODULE 3"],
  expiration_date:futureDate(0,1,0).toFormat("yyyy-MM-dd"),
  family_names:["TEST FAMILY 1","TEST FAMILY 2","TEST FAMILY 3"],
  class_names:["TEST CLASS 1","TEST CLASS 2","TEST CLASS 3"],
  capacity: 30,
} as const;

//emails for test users
// const TEST_USERS_EMAILS = ["user1@example.com","user2@example.com","user3@example.com"] as const

async function errorAction(...args: any) {
  throw new APIError("Internal Server Error", "Error Testing");
}

class TestTaskHandler extends TaskHandler {
  async testRevert() {
    console.log(
      `Testing Revert, number of procedure in revert stack: ${this.revert_stack.length}`
    );
    await this.revertChanges();
  }
  clearUsers() {
    this.users.clear();
  }
  clearGroups() {
    this.groups.clear();
  }
  clearTasks() {
    this.auth0_tasks.splice(0, this.auth0_tasks.length);
    this.db_tasks.splice(0, this.db_tasks.length);
    this.emailsToSent.splice(0, this.emailsToSent.length);
    return;
  }
  clearRevert() {
    if (this.revert_stack.length) {
      this.revert_stack.pop();
      this.clearRevert();
    }
    return;
  }
  clearError() {
    this.error_status_text = undefined;
    while (this.error_messages.length) {
      this.error_messages.pop();
    }
  }
  resetProperties() {
    this.auth0_token = undefined;
    this.clearTasks();
    this.clearRevert();
    this.clearError();
    this.clearUsers();
    this.clearGroups();
  }

  //   //add revert error at the input index, default at last
  setRevertError(index: number = this.revert_stack.length) {
    const procedure = new DBProcedure(
      "Error Procedure For Testing",
      errorAction,
      [123, "test payload", { first: "revert", second: "error", third: 321 }]
    );
    this.revert_stack.splice(index, 0, procedure);
    // console.log(this.revert_stack)
  }
  getRevertStack() {
    return this.revert_stack;
  }

  protected async postingRevertError(message: string) {
    await putLogEvent("TEST_REVERT_ERROR", message);
  }
  constructor() {
    super();
  }
}

async function expectError(fn: () => Promise<any>, status?: ERROR_STATUS_TEXT) {
  try {
    await fn();
    expect("Reached").not.toBeDefined();
  } catch (error: any) {
    // console.log(error);
    expect(error instanceof APIError).toBe(true);
    if (!(error instanceof APIError)) {
      console.log("unexpected error", error);
    }
    if (status) {
      expect(error.status).toBe(status);
    }
  }
}
const {
  emails,
  expiration_date,
  family_names,
  class_names,
  module_names,
  capacity,
} = TEST_DATA;

async function createTestUser(
  email: string,
  role: UserRole,
  info?: {
    managing?: string[];
    enrolled?: string;
    families?: string[];
    available_modules?: string[];
  }
) {
  const { managing, enrolled, families,available_modules } = info ?? {};
  let payload;
  const data = {
    email,
    name: `test ${role}`,
  };
  const defaultDate = expiration_date
  if (role === "admin") {
    payload = {
      ...data,
      role: "admin",
      expiration_date: null,
      available_modules: null,
    };
  } else if (role === "student") {
    payload = {
      role,
      ...data,
      expiration_date: defaultDate,
      enrolled: enrolled,
      families: families,
      available_modules:available_modules??[]
    };
  } else if (role === "parent" || role === "teacher") {
    payload = {
      role,
      ...data,
      expiration_date: defaultDate,
      managing: managing,
      available_modules: null,
    };
  } else {
    payload = {
      role: "student",
      ...data,
      expiration_date: defaultDate,
      families: [],
    };
  }
  payload = postUsersReqSchema.parse(payload);
  const user = await createUser(payload);
  return user;
}

async function createTestGroup(
  type: GroupType,
  name:string,
  info?: {
    manager_emails?: string[];
    student_emails?: string[];
    children_emails?: string[];
    available_modules?: string[];
    unlocked_modules?:string[]
  }
) {
  const {manager_emails,student_emails,children_emails,available_modules,unlocked_modules} = info??{}
  const base = {
    manager_emails:manager_emails??[],
    student_emails:null,
    children_emails:null,
    capacity:null,
    available_modules:null,
    unlocked_modules:null,
  }
  if(type==="class"){
    const payload = {
      ...base,
      group_name:name,
      type:"class" as const,
      student_emails :student_emails??[],
      available_modules :available_modules??[],
      unlocked_modules:unlocked_modules??[],
      capacity : capacity
    }
    const data = await createGroup(payload)
    return data
  }else if (type === "family"){
    const payload = {
      ...base,
      group_name:name,
      type:"family" as const,
      children_emails:children_emails??[]
    }
    const data = await createGroup(payload)
    return data
  }
  throw new Error("Unknown group type")
}

async function createTestModule(name:string) {
  return await createModule({module_name:name})
}

async function cleanUp(name:string) {
  console.log(`${name} start`)
  console.time(name)
  for(const name of[...family_names,...class_names]){
    try {
      const group = await findGroupByName(name)
      //group found
      await deleteGroup(group.group_id)
    } catch (error) {
      if(error instanceof APIError && error.status === "Resource Not Found"){
        //unexist class
      }else{
        console.error(`Hitting error when searching and deleting class in ${name}`,error)
      }
    }
  }
  try {
    const token = await getAccessToken()
    for(const email of emails){
      try {
        // console.log(`try to clean up ${email}`)
        await deleteUser(email)
        await deleteAuth0Account(token,email)
        await delay(500)
      } catch (error:any) {
        // console.log(error instanceof APIError , error?.status === "Resource Not Found")
        if(error instanceof APIError && error.status === "Resource Not Found"){
          //unexist class
          continue
        }else{
          console.error(`Hitting error when searching and deleting user in ${name}`,error)
        }
      }
    }
  } catch (error) {
    console.error(`Hitting error when getting auth0 access token in ${name}`,error)
  }
  try {
    const names:string[] = [...module_names]
    const modules = await getModules()
    const test_modules = modules.filter(m=>names.includes(m.module_name))
    for(const module of test_modules){
      try {
        await deleteModule(module.module_id)
      } catch (error) {
        if(error instanceof APIError && error.status === "Resource Not Found"){
          //unexist class
        }else{
          console.error(`Hitting error when  deleting module in ${name}`,error)
        }
      }
    }
  } catch (error) {
    console.error(`Hitting error when searching  module in ${name}`,error)
  }
  console.log(`${name} end`)
  console.timeEnd(name)
}

beforeEach(() => {
  console.log(`Testing ${expect.getState().currentTestName} start.`);
  console.time(expect.getState().currentTestName)
});

afterEach(() => {
  console.log(`Testing ${expect.getState().currentTestName} done.`);
  console.timeEnd(expect.getState().currentTestName)
});

beforeAll(async()=>{
  await cleanUp("Initail Clean Up")
},TIME_OUT)

afterAll(async()=>{
  await cleanUp("Final Clean Up")
},TIME_OUT)


test("Create user and send email",async()=>{
  //arrange 
  const email = emails[0]
  const payload = {
    name:"test user",
    role:"student",
    email,
    expiration_date
  }
  const parsed = postUsersReqSchema.parse(payload)
  const th = new TestTaskHandler()
  th.logic.createSingleUser(parsed)

  //act
  const {users} = await th.run()
  const user = users.get(email)

  //assert
  // console.log(user)
  expect(user).toBeDefined()
  expect(user?.role).toBe("student")
  expect(user?.email).toBe(email)
  expect(user?.name).toBe("test user")
  expect(user?.expiration_date?.getTime()).toEqual(parseDateStr(expiration_date)?.getTime())

  //clean up
  await th.testRevert()
},TIME_OUT)


test("Batch create students",async()=>{
  //arrange 
  const toCreate = emails.slice(0,emails.length)
  const module = await createTestModule(module_names[0])
  const testClass = await createTestGroup("class",class_names[0])
  const testFamily = await createTestGroup("family",family_names[0])
  const payload = {
    users:toCreate.map(email=>({email,name:"test batch create"})),
    role:"student",
    expiration_date,
    enrolled:testClass.group_id,
    families:[testFamily.group_id],
    available_modules:[module.module_id],
  }
  const parsed = postBatchCreateUsersReqSchema.parse(payload)
  const th = new TestTaskHandler()
  th.logic.batchCreateUser(parsed)
  //act
  const {users:data} = await th.run()

  //assert
  // console.log(user)
  for(const email of toCreate){
    const user = data.get(email)
    expect(user).toBeDefined()
    expect(user?.role).toBe("student")
    expect(user?.email).toBe(email)
    expect(user?.name).toBe("test batch create")
    expect(user?.expiration_date?.getTime()).toEqual(parseDateStr(expiration_date)?.getTime())
    expect(user?.enrolled).toEqual(testClass.group_id)
    expect(user?.families).toContain(testFamily.group_id)
    expect(user?.available_modules).toContain(module.module_id)
  }

  //clean up
  await th.testRevert()
  await deleteGroup(testClass.group_id)
  await deleteGroup(testFamily.group_id)
  await deleteModule(module.module_id)
},TIME_OUT)

test("Delete User",async()=>{
  //arrange 
  const email = emails[0]
  const payload = {
    name:"test user",
    role:"student",
    email,
    expiration_date
  }
  const parsed = postUsersReqSchema.parse(payload)
  const creater = new TestTaskHandler()
  const deleter = new TestTaskHandler()
  creater.logic.createSingleUser(parsed)
  deleter.logic.deleteUser(email)

  //act
  await creater.run()
  await deleter.run()

  //assert
  await expectError(async()=>{
    await findSingleUser(email)
  },"Resource Not Found")
  await expectError(async()=>{
    await getAuth0UserByEmail(creater.getAuth0Token(),email)
  },"Resource Not Found")
},TIME_OUT)



test("Create Teacher with classes",async()=>{
  //arrage 
  const email = emails[0]
  const class1 = await createTestGroup("class",class_names[0])
  const class2 = await createTestGroup("class",class_names[2])
  const classIds = [class1.group_id,class2.group_id]
  //act 
  const user = await createTestUser(email,"teacher",{managing:classIds})
  
  //assert
  expect(user.role).toBe("teacher")
  expect(sameList(user.managing,classIds)).toBeTruthy()
  
  //clean up
  await deleteGroup(class1.group_id)
  await deleteGroup(class2.group_id)
  await deleteUser(user.email)
},TIME_OUT)


test("Create parent with families",async()=>{
  //arrage 
  const email = emails[0]
  const family1 = await createTestGroup("family",family_names[0])
  const family2 = await createTestGroup("family",family_names[2])
  const familyIds = [family1.group_id,family2.group_id]
  //act 
  const user = await createTestUser(email,"parent",{managing:familyIds})
  
  //assert
  expect(user.role).toBe("parent")
  expect(sameList(user.managing,familyIds)).toBeTruthy()
  
  //clean up
  await deleteGroup(family1.group_id)
  await deleteGroup(family2.group_id)
  await deleteUser(user.email)
},TIME_OUT)


test("Create class",async ()=>{
  //arrange
  const student = await createTestUser(emails[0],"student")
  const teacher = await createTestUser(emails[1],"teacher")
  const locked = await createTestModule(module_names[0])
  const unlocked = await createTestModule(module_names[1])
  const group_name = class_names[0]
  const payload:PostGroupsReq = {
    type:"class",
    group_name,
    capacity,
    manager_emails:[teacher.email],
    student_emails:[student.email],
    available_modules:[locked.module_id,unlocked.module_id],
    unlocked_modules:[unlocked.module_id]
  }
  
  //act
  const data = await createGroup(payload)
  
  //assert
  expect(data.type).toBe("class")
  expect(data.group_name).toBe(group_name)
  expect(data.capacity).toBe(capacity)
  expect(sameList(data.managers,[teacher.user_id])).toBeTruthy()
  expect(sameList(data.students,[student.user_id])).toBeTruthy()
  expect(sameList(data.available_modules,[locked.module_id,unlocked.module_id])).toBeTruthy
  expect(sameList(data.unlocked_modules,[unlocked.module_id])).toBeTruthy
  
  //clean up
  await deleteModule(locked.module_id)
  await deleteModule(unlocked.module_id)
  await deleteUser(student.email)
  await deleteUser(teacher.email)
  await deleteGroup(data.group_id)
},TIME_OUT)

test("Create family",async ()=>{
  //arrange
  const student = await createTestUser(emails[0],"student")
  const parent = await createTestUser(emails[1],"parent")
  const group_name = family_names[0]
  const payload:PostGroupsReq = {
    type:"family",
    group_name,
    manager_emails:[parent.email],
    children_emails:[student.email]
  }
  
  
  //act
  const data = await createGroup(payload)
  
  //assert
  expect(data.type).toBe("family")
  expect(data.group_name).toBe(group_name)
  expect(data.capacity).toBe(-1)
  expect(sameList(data.managers,[parent.user_id])).toBeTruthy()
  expect(sameList(data.children,[student.user_id])).toBeTruthy()
  
  //clean up
  await deleteUser(student.email)
  await deleteUser(parent.email)
  await deleteGroup(data.group_id)
},TIME_OUT)

test("DB realtion creation and onDelete Functioning",async()=>{
  //arrange
  const email = emails[0]
  const group_name = class_names[0]
  const user = await createTestUser(email,"student")
  const group = await createTestGroup("class",group_name,{
    student_emails:[email]
  })

  //act
  const before =  await findSingleUser(email)
  await deleteGroup(group.group_id)
  const after = await findSingleUser(email)

  //assert
  expect(user.enrolled).toBeUndefined()
  expect(before.enrolled).toBe(group.group_id)
  expect(after.enrolled).toBeUndefined()

  //clean up
  await deleteUser(email)

},TIME_OUT)



test("Create Teacher with classes",async()=>{
  //arrage 
  const email = emails[0]
  const class1 = await createTestGroup("class",class_names[0])
  const class2 = await createTestGroup("class",class_names[2])
  const classIds = [class1.group_id,class2.group_id]
  //act 
  const user = await createTestUser(email,"teacher",{managing:classIds})
  
  //assert
  expect(user.role).toBe("teacher")
  expect(sameList(user.managing,classIds)).toBeTruthy()
  
  //clean up
  await deleteGroup(class1.group_id)
  await deleteGroup(class2.group_id)
  await deleteUser(user.email)
},TIME_OUT)


test("Create parent with families",async()=>{
  //arrage 
  const email = emails[0]
  const family1 = await createTestGroup("family",family_names[0])
  const family2 = await createTestGroup("family",family_names[2])
  const familyIds = [family1.group_id,family2.group_id]
  //act 
  const user = await createTestUser(email,"parent",{managing:familyIds})
  
  //assert
  expect(user.role).toBe("parent")
  expect(sameList(user.managing,familyIds)).toBeTruthy()
  
  //clean up
  await deleteGroup(family1.group_id)
  await deleteGroup(family2.group_id)
  await deleteUser(user.email)
},TIME_OUT)

test("Updating class modules",async()=>{
  //arrange 
  const module1 = await createTestModule(module_names[0])
  const module2 = await createTestModule(module_names[1])
  const module3 = await createTestModule(module_names[2])
  const group = await createTestGroup("class",class_names[0],{
    available_modules:[module1.module_id,module2.module_id],
    unlocked_modules:[module1.module_id]
  })
  const payload:PutClassesModulesReq ={
    group_id:group.group_id,
    toAdd:[module3.module_id],
    toRemove:[module2.module_id],
    toLock:[module1.module_id],
    toUnlock:[module3.module_id]
  }

  //act
  const {group_id,toAdd,toRemove,toLock,toUnlock}=payload
  const updated = await updateClassAvailableModules(group_id,toAdd,toRemove,toLock,toUnlock)

  //assert
  expect(sameList(updated.available_modules,[module1.module_id,module3.module_id])).toBeTruthy()
  expect(sameList(updated.unlocked_modules,[module3.module_id])).toBeTruthy()

  //clean up
  await deleteGroup(updated.group_id)
  await deleteModule(module1.module_id)
  await deleteModule(module2.module_id)
  await deleteModule(module3.module_id)

},TIME_OUT)


//testing reverts
test("Revert create user",async()=>{
  //arrange 
  const family = await createTestGroup("class",family_names[0])
  const email = emails[0]
  const payload = {
    name:"test user",
    role:"teacher",
    email,
    expiration_date,
    managing:[family.group_id]
  }
  const parsed = postUsersReqSchema.parse(payload)
  const th = new TestTaskHandler()
  th.logic.createSingleUser(parsed)

  //act
  const {users} = await th.run()
  await th.testRevert()

  //assert
  const updated = await findSingleGroup(family.group_id)
  expect(updated.managers.length).toBe(0)
  await expectError(async()=>{
    await findSingleUser(email)
  },"Resource Not Found")

  //clean up
  await deleteGroup(family.group_id)
},TIME_OUT)


test("Revert batch create students",async()=>{
  //arrange 
  const toCreate = emails.slice(0,emails.length)
  const testClass = await createTestGroup("class",class_names[0])
  const testFamily = await createTestGroup("family",family_names[0])
  const payload = {
    users:toCreate.map(email=>({email,name:"test batch create"})),
    role:"student",
    expiration_date,
    enrolled:testClass.group_id,
    families:[testFamily.group_id],
  }
  const parsed = postBatchCreateUsersReqSchema.parse(payload)
  const th = new TestTaskHandler()
  th.logic.batchCreateUser(parsed)
  //act
  const {users:data} = await th.run()
  await th.testRevert()


  //assert
  const users = await findManyUsers({email:toCreate,exact:false})
  const updatedFam = await findSingleGroup(testFamily.group_id)
  const updatedClass = await findSingleGroup(testClass.group_id)
  expect(users.length).toBe(0)
  expect(updatedFam.children.length).toBe(0)
  expect(updatedClass.students.length).toBe(0)

  //clean up
  await deleteGroup(testClass.group_id)
  await deleteGroup(testFamily.group_id)
},TIME_OUT)

test("Revert delete User",async()=>{
  //arrange 
  const module = await createTestModule(module_names[0])
  const classData = await createTestGroup("class",class_names[0])
  const fam = await createTestGroup("family",family_names[0])
  const email = emails[0]
  const payload = {
    name:"test user",
    role:"student",
    email,
    expiration_date,
    enrolled:classData.group_id,
    families:[fam.group_id],
    available_modules:[module.module_id]
  }
  const parsed = postUsersReqSchema.parse(payload)
  const creater = new TestTaskHandler()
  const deleter = new TestTaskHandler()
  creater.logic.createSingleUser(parsed)
  deleter.logic.deleteUser(email)

  //act
  await creater.run()
  await deleter.run()
  await deleter.testRevert()

  //assert
  const user = await findSingleUser(email)
  const auth0Ac =  await getAuth0UserByEmail(creater.getAuth0Token(),email)
  const updatedClass = await findSingleGroup(classData.group_id)
  const updatedFam = await findSingleGroup(fam.group_id)
  expect(user.role).toBe("student")
  expect(user.email).toBe(email)
  expect(user.name).toBe("test user")
  expect(user.expiration_date?.getTime()).toEqual(parseDateStr(expiration_date).getTime())
  expect(user.enrolled).toEqual(classData.group_id)
  expect(user.families).toContain(fam.group_id)
  expect(user.available_modules).toContain(module.module_id)
  expect(auth0Ac.email).toBe(email)
  expect(updatedClass.students).toContain(user.user_id)
  expect(updatedFam.children).toContain(user.user_id)

  //clean up
  const cleaner = new TestTaskHandler()
  cleaner.logic.deleteUser(email)
  await cleaner.run()
  await deleteGroup(updatedClass.group_id)
  await deleteGroup(updatedFam.group_id)
  await deleteModule(module.module_id)
},TIME_OUT)



test("Handling Revert Error",async()=>{
  //arrange
  const email = emails[0]
  const group = await createTestGroup("class",class_names[0])
  const th = new TestTaskHandler()
  const payload = {
    name:"test user",
    role:"student",
    email,
    expiration_date,
    enrolled:group.group_id
  }
  const parsed = postUsersReqSchema.parse(payload)
  th.logic.createSingleUser(parsed)
  
  //act
  const {users} = await th.run()
  th.setRevertError()
  await th.testRevert()

  //assert
  //nothing is reverted,i.e. user stil exist and class
  const user = await findSingleUser(email)
  const updatedGroup = await findSingleGroup(group.group_id)
  expect(user.enrolled).toBe(group.group_id)
  expect(sameList(updatedGroup.students,[user.user_id])).toBeTruthy()

  //clean up
  const cleaner = new TestTaskHandler()
  cleaner.logic.deleteUser(email)
  await cleaner.run()
  await deleteGroup(group.group_id)

},TIME_OUT)