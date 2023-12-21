import {
  FC,
  FormEvent,
  useState,
  Dispatch,
  SetStateAction,
  useId,
  useEffect,
} from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Search, Check } from "lucide-react";
import { AxiosError } from "axios";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "./ui/input";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "./ui/use-toast";
import { Label } from "./ui/label";

import {
  cn,
  ClientErrorHandler,
  capitalizeFirstLetter,
  myFilterArray,
} from "@/lib/utils";
import ShowExpiration from "./ShowExpiration";
import { UpdateAllExpiration } from "./UpdateExpiration";
import { Group, Module, User } from "@/models/db_schemas";
import { emailSchema, trimedNonEmptyString } from "@/models/utlis_schemas";
import { requestAPI } from "@/lib/request";
import {
  GetGroupModulesRes,
  PutGroupModulesReq,
  PutGroupsReq,
  batchGetGroupsResSchema,
  getGroupByIdResSchema,
  getGroupEnrollsResSchema,
  getGroupManagesResSchema,
  getGroupModulesResSchema,
  getGroupResSchema,
  getModulesResSchema,
  getUserByIdResSchema,
  getUserManagesResSchema,
  putGroupModulesResSchema,
  putGroupsResSchema,
} from "@/models/api_schemas";
import { Lock, Unlock } from "lucide-react";
import DeleteGroup from "./DeleteGroup";
import RemoveManagersFromGroup from "./RemoveManagersFromGroup";
import BatchAddUsersToGroup from "./batchAddUsersToGroup";
import RemoveStudentFromGroup from "./RemoveStudentFromGroup";
import { set } from "date-fns";

const formSchema = z.object({
  email: emailSchema,
});

interface Props {
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  handleChangeGroup: (data: Group | undefined) => Promise<void>;
}

const SearchManager: FC<Props> = ({
  isLoading,
  setIsLoading,
  handleChangeGroup,
}) => {
  const [manager, setManager] = useState<User | undefined>();
  const [managing, setManaging] = useState<Group[]>([]);
  //error message when select group
  // const [groupErrorMessage,setGroupErrorMessage] = useState<string>("")
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });
  //handle search serach teacher
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setManager(undefined);
    setManaging([]);
    await handleChangeGroup(undefined);
    setIsLoading(true);
    try {
      // console.log(values);
      const { email } = values;
      const data = await requestAPI("users", "GET", {}, {}, email);
      const user = getUserByIdResSchema.parse(data);

      const groupType =
        user.role === "parent"
          ? "family"
          : user.role === "teacher"
          ? "class"
          : "";
      // console.log(managingIds)
      const canManage = user.role === "parent" || user.role === "teacher";

      if (canManage) {
        setManager(user);
        try {
          const groupData = await requestAPI(
            "user-manages",
            "GET",
            { email: user.email },
            {}
          );
          // console.log(groupData);
          const groups = getUserManagesResSchema.parse(groupData);
          // console.log(groups);
          setManaging(groups);
        } catch (error) {
          const handler = new ClientErrorHandler(error);
          handler.log();
          toast({
            variant: "destructive",
            title: "Search error",
            description: handler.message,
          });
        }
      } else {
        form.setError("email", { message: "Invalid teacher/parent email!" });
      }
    } catch (error: any) {
      if (error instanceof AxiosError && error.response?.status === 404) {
        form.setError("email", { message: "Invalid teacher/parent email!" });
      } else {
        const handler = new ClientErrorHandler(error);
        handler.log();
        toast({
          variant: "destructive",
          title: "Search error",
          description: handler.message,
        });
      }
    }
    setIsLoading(false);
  };

  //handle select class
  const handleSelect = async (selectedId: string) => {
    // console.log("selected",selectedIds)
    // setClassErrorMessage("")
    if (isLoading) return;
    // setIsLoading(true)
    const target = managing.find((g) => g.groupId === selectedId);
    if (target) {
      await handleChangeGroup(target);
    }
    // try {
    //   const response = await axios.get(`/api/v1/classes/${selectedId}`)
    //   const data = GetClassesResSchema.parse(response.data)
    // } catch (error:any) {
    //   if(error instanceof AxiosError && error.response?.status===404){
    //     setClassErrorMessage("Inaccessible class")
    //     setTeaching(prev=>prev.filter(entry=>entry.class_id!==selectedId))
    //     await handleChangeGroup(undefined)
    //   }else{
    //     const handler = new ClientErrorHandler(error)
    //     handler.log()
    //     toast({
    //       variant:"destructive",
    //       title:"Search lass Error",
    //       description:handler.message
    //     })
    //   }
    // }
    // setIsLoading(false)
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="w-1/2 my-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex gap-2 items-center">
                  Find by email
                  <Search size={16} />
                </FormLabel>
                <div className="flex gap-5 items-center">
                  <Input
                    placeholder="Search..."
                    {...field}
                    type="email"
                  ></Input>
                  <FormControl>
                    <Button
                      onClick={() => form.reset()}
                      variant={"ghost"}
                      className="p-1"
                      type="reset"
                    >
                      <X size={30} />
                    </Button>
                  </FormControl>
                  <FormControl>
                    <Button
                      type="submit"
                      className=" rounded-xl"
                      disabled={isLoading}
                    >
                      {isLoading ? "loading..." : "search"}
                    </Button>
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
      {manager ? (
        <>
          <div className="my-4 flex space-x-10 items-center">
            <p className="space-x-1">
              <span>Name: </span>
              <span>{manager.name}</span>
            </p>
            <Select onValueChange={handleSelect} disabled={isLoading}>
              <SelectTrigger className="w-1/6">
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>
                    {manager.role === "parent"
                      ? "Family"
                      : manager.role === "teacher"
                      ? "Class"
                      : ""}
                  </SelectLabel>
                  {managing.map((entry) => {
                    return (
                      <SelectItem
                        key={`select-${entry.groupId}`}
                        value={entry.groupId}
                      >
                        {entry.groupName}
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              </SelectContent>
            </Select>
            {/* <p className=" text-destructive text-sm">{classErrorMessage}</p> */}
          </div>
        </>
      ) : null}
    </>
  );
};

const InputGroupID: FC<Props> = ({
  isLoading,
  setIsLoading,
  handleChangeGroup,
}) => {
  const [value, setValue] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const { toast } = useToast();
  const inputId = useId();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = value.trim();
    if (!input.length) {
      setMessage("Please fill in group ID.");
      return;
    }
    if (isLoading) return;
    setIsLoading(true);
    try {
      // console.log("/api/v1/classes?class_id="+class_id)
      const data = await requestAPI("groups", "GET", {}, {}, input);
      console.log(data);
      const group = getGroupByIdResSchema.parse(data);
      await handleChangeGroup(group);
    } catch (error: any) {
      if (error instanceof AxiosError && error.response?.status === 404) {
        setMessage("Invalid group ID");
      } else {
        const handler = new ClientErrorHandler(error);
        handler.log();
        toast({
          title: "Search Error",
          description: handler.message,
          variant: "destructive",
        });
      }
      await handleChangeGroup(undefined);
    }
    setIsLoading(false);
  };

  return (
    <>
      <form className="my-4 w-1/2 space-y-2" onSubmit={handleSubmit}>
        <Label
          className={cn(
            "flex gap-2 items-center",
            message.length ? "text-destructive" : ""
          )}
          htmlFor={inputId}
        >
          Find by group ID
          <Search size={16} />
        </Label>
        <div className="flex gap-5 items-center" id={inputId}>
          <Input
            placeholder="Search..."
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setMessage("");
            }}
          ></Input>
          <Button
            onClick={() => setValue("")}
            variant={"ghost"}
            className="p-1"
            type="reset"
          >
            <X size={30} />
          </Button>
          <Button type="submit" className=" rounded-xl" disabled={isLoading}>
            {isLoading ? "loading..." : "search"}
          </Button>
        </div>
        <div className="text-sm font-medium text-destructive">{message}</div>
      </form>
    </>
  );
};

const InputGroupName: FC<Props> = ({
  isLoading,
  setIsLoading,
  handleChangeGroup,
}) => {
  const [value, setValue] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const { toast } = useToast();
  const inputName = useId();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = value.trim();
    if (!input.length) {
      setMessage("Please fill in group name.");
      return;
    }
    if (isLoading) return;
    setIsLoading(true);
    try {
      // console.log("/api/v1/classes?class_id="+class_id)
      const data = await requestAPI(
        "group-by-name",
        "GET",
        { group_name: value },
        {}
      );
      const group = getGroupResSchema.parse(data);
      await handleChangeGroup(group);
    } catch (error: any) {
      if (error instanceof AxiosError && error.response?.status === 404) {
        setMessage("Invalid group name");
      } else {
        const handler = new ClientErrorHandler(error);
        handler.log();
        toast({
          title: "Search Error",
          description: handler.message,
          variant: "destructive",
        });
      }
      await handleChangeGroup(undefined);
    }
    setIsLoading(false);
  };

  return (
    <>
      <form className="my-4 w-1/2 space-y-2" onSubmit={handleSubmit}>
        <Label
          className={cn(
            "flex gap-2 items-center",
            message.length ? "text-destructive" : ""
          )}
          htmlFor={inputName}
        >
          Find by group name
          <Search size={16} />
        </Label>
        <div className="flex gap-5 items-center" id={inputName}>
          <Input
            placeholder="Search..."
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setMessage("");
            }}
          ></Input>
          <Button
            onClick={() => setValue("")}
            variant={"ghost"}
            className="p-1"
            type="reset"
          >
            <X size={30} />
          </Button>
          <Button type="submit" className=" rounded-xl" disabled={isLoading}>
            {isLoading ? "loading..." : "search"}
          </Button>
        </div>
        <div className="text-sm font-medium text-destructive">{message}</div>
      </form>
    </>
  );
};

interface CapacProps extends Props {
  data: Group;
}

const UpdateCapacity: FC<CapacProps> = ({
  isLoading,
  setIsLoading,
  handleChangeGroup,
  data,
}) => {
  const { toast } = useToast();
  const [open, setOpen] = useState<boolean>(false);
  const updateScehma = z.object({
    capacity: z
      .string()
      .nonempty({ message: "Required" })
      .refine(
        (cap) => {
          return Number(cap) > 0;
        },
        { message: "Capacity must greater than 0." }
      )
      .refine(
        (input) => {
          const cap = Number(input);
          return cap >= data.studentCount;
        },
        {
          message:
            "Updated capacity must not be less than the number of current students .",
        }
      )
      .refine((cap) => !isNaN(Number(cap)), { message: "Invalid input" }),
  });

  const form = useForm<z.infer<typeof updateScehma>>({
    resolver: zodResolver(updateScehma),
    defaultValues: {
      capacity: String(data.capacity),
    },
  });
  const disableSave = Number(form.watch("capacity")) === data.capacity;

  const onSubmit = async (values: z.infer<typeof updateScehma>) => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const payload: PutGroupsReq = {
        group_id: data.groupId,
        update: {
          capacity: Number(values.capacity),
        },
      };
      const response = await requestAPI("groups", "PUT", {}, payload);
      toast({
        title: "Updated",
      });
      const group = putGroupsResSchema.parse(response);
      await handleChangeGroup(group);
      setOpen(false);
    } catch (error: any) {
      const handler = new ClientErrorHandler(error);
      handler.log();
      toast({
        variant: "destructive",
        title: "Update error",
        description: handler.message,
      });
      setIsLoading(false);
    }
  };

  if (data.type !== "class") return null;
  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button disabled={isLoading} variant={"secondary"} className="">
            {isLoading ? "loading..." : "Update class capacity"}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Update capacity</DialogTitle>
            <DialogDescription>
              Update the capacity of {data.groupName}. Click save when you are
              done.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="update cap">Update Capacity</FormLabel>
                    <Input id="update cap" type="number" min="1" {...field} />
                    <FormDescription>
                      <span>
                        Current number of students: {data.studentCount}. Current
                        capacity: {data.capacity}
                      </span>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <FormControl>
                  <Button
                    type="submit"
                    disabled={isLoading || disableSave}
                    className="mt-4"
                  >
                    {isLoading ? "Loading..." : "Save changes"}
                  </Button>
                </FormControl>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
};

interface NameProps extends Props {
  data: Group;
}

const UpdateName: FC<NameProps> = ({
  isLoading,
  setIsLoading,
  handleChangeGroup,
  data,
}) => {
  const { toast } = useToast();
  const [open, setOpen] = useState<boolean>(false);
  const updateScehma = z.object({
    group_name: trimedNonEmptyString,
  });

  const form = useForm<z.infer<typeof updateScehma>>({
    resolver: zodResolver(updateScehma),
    defaultValues: {
      group_name: data.groupName,
    },
  });

  const disableSave = form.watch("group_name") === data.groupName;

  const onSubmit = async (values: z.infer<typeof updateScehma>) => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const payload: PutGroupsReq = {
        group_id: data.groupId,
        update: {
          groupName: values.group_name,
        },
      };
      const response = await requestAPI("groups", "PUT", {}, payload);
      toast({
        title: "Updated",
      });
      const group = putGroupsResSchema.parse(response);
      await handleChangeGroup(group);
      setOpen(false);
    } catch (error: any) {
      const handler = new ClientErrorHandler(error);
      handler.log();
      toast({
        variant: "destructive",
        title: "Update error",
        description: handler.message,
      });
      setIsLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button disabled={isLoading} variant={"secondary"} className="">
            {isLoading ? "loading..." : `Update ${data.type} name`}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Update {data.type} name</DialogTitle>
            <DialogDescription>
              Update the name of {data.groupName}. Click save when you are done.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <FormField
                control={form.control}
                name="group_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="update name">
                      Update {capitalizeFirstLetter(data.groupName)}
                      {"'"}s Name
                    </FormLabel>
                    <Input id="update name" {...field} />
                    <FormDescription>
                      <span>Current name: {data.groupName}.</span>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <FormControl>
                  <Button
                    type="submit"
                    disabled={isLoading || disableSave}
                    className="mt-4"
                  >
                    {isLoading ? "Loading..." : "Save changes"}
                  </Button>
                </FormControl>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
};

type SelectedModule = Module & {
  locked: boolean;
};

const ManageGroup: FC = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [data, setData] = useState<Group | undefined>();
  const [students, setStudents] = useState<User[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
  const [allModules, setAllModules] = useState<Module[]>([]);
  const [availableModules, setAvailableModules] = useState<GetGroupModulesRes>(
    []
  );
  const [seletcedModules, setSelectedModules] = useState<SelectedModule[]>([]);
  const [disAbleModuleSave, setDisableModuleSave] = useState(false);
  const groupType = data?.type;
  const managersType =
    groupType === "family"
      ? "parent"
      : groupType === "class"
      ? "teacher"
      : undefined;
  const modulesReady = allModules.filter(
    (m) => !seletcedModules.map((s) => s.moduleId).includes(m.moduleId)
  );

  const { toast } = useToast();

  //get modules
  useEffect(() => {
    requestAPI("modules", "GET", { module_id: [] }, {})
      .then((data) => getModulesResSchema.parse(data))
      .then((modules) => setAllModules(modules));
    setSelectedModules([]);
  }, []);

  const reload = async (currentGroup: Group | undefined = data) => {
    // console.log(currentGroup)
    if (!currentGroup) return;
    setIsLoading(true);
    const { groupId, groupName, type, studentCount } = currentGroup;
    //get students, managers and modules
    const api_requests = [
      requestAPI("group-enrolls", "GET", { group_id: groupId }, {}),
      requestAPI("group-manages", "GET", { group_id: groupId }, {}),
      requestAPI("group-modules", "GET", { group_id: groupId }, {}),
    ];
    const results = await Promise.allSettled(api_requests);

    function allFullfilled(
      value: PromiseSettledResult<any>[]
    ): value is PromiseFulfilledResult<any>[] {
      return value.every((result) => result.status === "fulfilled");
    }
    if (!allFullfilled(results)) {
      const messages = [];
      for (const result of results) {
        if (result.status === "rejected") {
          messages.push(result.reason);
        }
      }
      const message = messages.join(" ");
      toast({
        variant: "destructive",
        title: "Reload error",
        description: message,
      });
      setIsLoading(false);
      return;
    }
    const [sData, managerData, moduleData] = results.map(
      (result) => result.value
    );
    // console.log(sData,managerData,moduleData)
    setStudents(getGroupEnrollsResSchema.parse(sData));
    setManagers(getGroupManagesResSchema.parse(managerData));
    const available_modules = getGroupModulesResSchema.parse(moduleData);
    //set modules
    setAvailableModules(available_modules);
    const selected = available_modules.map((m) => {
      const found = allModules.find((module) => module.moduleId === m.moduleId);
      const locked = !m.unlocked;
      const mName = found?.moduleName ?? "Unknown";
      return { moduleId: m.moduleId, moduleName: mName, locked };
    });
    setSelectedModules(selected);
    // console.log(selected)

    setIsLoading(false);
  };

  const handleChangeGroup = async (
    payload: Group | undefined
  ): Promise<void> => {
    // console.log(payload)
    setData(payload);
    setStudents([]);
    setManagers([]);
    setAvailableModules([]);
    setSelectedModules([]);
    if (!payload) return;
    await reload(payload);
  };

  const handleAddModule = (module: Module) => {
    setSelectedModules((prev) => [...prev, { ...module, locked: true }]);
    setDisableModuleSave(false);
  };
  const handleRemoveModule = (target: SelectedModule) => {
    setSelectedModules((prev) =>
      prev.filter((m) => m.moduleId !== target.moduleId)
    );
    setDisableModuleSave(false);
  };

  const handleLock = (target: SelectedModule) => {
    const changed = seletcedModules.map((m) =>
      m.moduleId === target.moduleId ? { ...m, locked: true } : m
    );
    setSelectedModules(changed);
    setDisableModuleSave(false);
  };

  const handleUnlock = (target: SelectedModule) => {
    const changed = seletcedModules.map((m) =>
      m.moduleId === target.moduleId ? { ...m, locked: false } : m
    );
    setSelectedModules(changed);
    setDisableModuleSave(false);
  };

  // const handleResetModules = () => {
  //   setSelectedModules([]);
  //   setDisableModuleSave(false);
  // };
  const handleSaveModules = async () => {
    if (!data) return;
    const selectedIds = seletcedModules.map((m) => m.moduleId);
    const avaIds = availableModules.map((m) => m.moduleId);
    const oldeLocked = seletcedModules
      .filter((m) => m.locked)
      .map((m) => m.moduleId);
    const { included: oldModules, excluded: toAdd } = myFilterArray(
      seletcedModules,
      (val) => avaIds.includes(val.moduleId)
    );
    const { excluded: toRemove } = myFilterArray(avaIds, (val) =>
      selectedIds.includes(val)
    );
    const oldLockedIds = availableModules
      .filter((m) => !m.unlocked)
      .map((m) => m.moduleId);
    const { included: newLocked, excluded: newUnlocked } = myFilterArray(
      seletcedModules,
      (val) => val.locked
    );

    //new modules are default to be locked
    //old modules to lock
    const toLock = newLocked
      .filter((m) => !oldLockedIds.includes(m.moduleId))
      .map((m) => m.moduleId);
    const newModulesToUnlock = toAdd
      .filter((m) => !m.locked)
      .map((m) => m.moduleId);
    //unlcok old modules + unlcok new modules
    const toUnlock = oldLockedIds
      .filter((id) => newUnlocked.map((m) => m.moduleId).includes(id))
      .concat(newModulesToUnlock);
    // console.log({
    //   seletcedModules,
    //   newLocked,
    //   newUnlocked,
    //   oldLockedIds,
    // });
    if (
      !toAdd.length &&
      !toRemove.length &&
      !toLock.length &&
      !toUnlock.length
    ) {
      setDisableModuleSave(true);
      return;
    }
    setIsLoading(true);
    try {
      const payload: PutGroupModulesReq = {
        group_id: data.groupId,
        add: toAdd.map((m) => m.moduleId),
        remove: toRemove,
        lock: toLock,
        unlock: toUnlock,
      };
      const res = await requestAPI("group-modules", "PUT", {}, payload);
      // console.log(res);
      const updated = putGroupModulesResSchema.parse(res);
      toast({
        title: "Updated",
      });
      // console.log(updated)
      //force reload
      await handleChangeGroup({ ...data });
    } catch (error: any) {
      console.log(error);
      const handler = new ClientErrorHandler(error);
      handler.log();
      toast({
        variant: "destructive",
        title: "Update error",
        description: handler.message,
      });
    }
    setIsLoading(false);
  };

  return (
    <>
      <div className="m-8">
        {/* <div>Class ID: {classId}</div> */}
        <Tabs defaultValue="teacher" className="">
          <div className="flex justify-center">
            <TabsList className="">
              <TabsTrigger value="teacher">By manager</TabsTrigger>
              <TabsTrigger value="groupId">By group ID</TabsTrigger>
              <TabsTrigger value="groupName">By group name</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="teacher">
            <SearchManager
              {...{ isLoading, setIsLoading, handleChangeGroup }}
            />
          </TabsContent>
          <TabsContent value="groupId">
            <InputGroupID {...{ isLoading, setIsLoading, handleChangeGroup }} />
          </TabsContent>
          <TabsContent value="groupName">
            <InputGroupName
              {...{ isLoading, setIsLoading, handleChangeGroup }}
            />
          </TabsContent>
        </Tabs>
        {data ? (
          <>
            {/* <pre>{JSON.stringify(data,null,2)}</pre> */}
            <div className="space-y-4">
              <div className="space-y-3  col-span-2">
                <p>{capitalizeFirstLetter(groupType ?? "")} ID:</p>
                <p>{data.groupId}</p>
                <p>{capitalizeFirstLetter(groupType ?? "")} Name:</p>
                <div className=" space-x-24">
                  <span>{data.groupName}</span>{" "}
                  <UpdateName
                    {...{ isLoading, setIsLoading, handleChangeGroup, data }}
                  />
                </div>
                <div className=" grid grid-cols-2 ">
                  <p>Student count: </p>
                  <p>{data.studentCount}</p>
                  <p>Student updated at: </p>
                  <p>{data.studentLastModifiedTime.toLocaleString()}</p>
                  <p>Module updated at: </p>
                  <p>{data.moduleLastModifiedTime.toLocaleString()}</p>
                </div>
                {/* <p>{capitalizeFirstLetter(managersType ?? "")} in {groupType}:</p>
                <p className="space-x-3">
                  {managers.map((teacher, index) => {
                    return (
                      <span
                        key={`${teacher.email}-${index}`}
                      >{`${teacher.name} (${teacher.email})`}</span>
                    );
                  })}
                </p> */}
              </div>
              <div className=" space-y-3">
                <div className="flex space-x-4 items-center">
                  <p>
                    {groupType === "class"
                      ? "Teachers"
                      : groupType === "family"
                      ? "Parents"
                      : ""}{" "}
                    {":"}
                  </p>
                </div>
                <ul className="max-h-[24rem]  min-h-[8rem] overflow-auto rounded-md border border-input bg-transparent px-3 py-2 ">
                  {managers.map((manager, index) => {
                    return (
                      <li
                        key={`${manager.userId}-${index}`}
                        className="flex items-center  space-x-4"
                      >
                        <span>{`${index + 1}.`}</span>
                        <span className="mx-4">{manager.name}</span>
                        <span>{manager.email}</span>
                        <ShowExpiration
                          expiration={manager.expirationDate}
                          content=""
                        />
                        <div className="flex-grow flex justify-end">
                          <RemoveManagersFromGroup
                            {...{
                              manager,
                              handleChangeGroup,
                              isLoading,
                              setIsLoading,
                              group_name: data.groupName,
                              group_id: data.groupId,
                            }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="space-x-5">
                  {groupType && managersType ? (
                    <>
                      <BatchAddUsersToGroup
                        {...{
                          isLoading,
                          setIsLoading,
                          users: managers,
                          handleChangeGroup,
                          type: groupType,
                          role: managersType,
                          group_id: data.groupId,
                        }}
                      />
                      <UpdateAllExpiration
                        {...{
                          isLoading,
                          setIsLoading,
                          users: managers,
                          reload,
                          role: managersType,
                        }}
                      />
                    </>
                  ) : null}
                </div>
                <div className="flex space-x-4 items-center">
                  <p>
                    {groupType === "class"
                      ? "Students"
                      : groupType === "family"
                      ? "Children"
                      : ""}{" "}
                    {groupType === "class"
                      ? `(${students.length}/${data.capacity})`
                      : null}
                    {":"}
                  </p>
                  {groupType === "class" ? (
                    <UpdateCapacity
                      {...{ isLoading, setIsLoading, handleChangeGroup, data }}
                    />
                  ) : null}
                </div>
                <ul className="max-h-[24rem]  min-h-[8rem] overflow-auto rounded-md border border-input bg-transparent px-3 py-2 ">
                  {students.map((student, index) => {
                    return (
                      <li
                        key={`${student.userId}-${index}`}
                        className="flex items-center  space-x-4"
                      >
                        <span>{`${index + 1}.`}</span>
                        <span className="mx-4">{student.name}</span>
                        <span>{student.email}</span>
                        <ShowExpiration
                          expiration={student.expirationDate}
                          content=""
                        />
                        <div className="flex-grow flex justify-end">
                          <RemoveStudentFromGroup
                            {...{
                              student,
                              handleChangeGroup,
                              isLoading,
                              setIsLoading,
                              group_name: data.groupName,
                              group_id: data.groupId,
                            }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="space-x-5">
                  {groupType ? (
                    <BatchAddUsersToGroup
                      {...{
                        isLoading,
                        setIsLoading,
                        users: students,
                        handleChangeGroup,
                        type: groupType,
                        role: "student",
                        group_id: data.groupId,
                      }}
                    />
                  ) : null}
                  <UpdateAllExpiration
                    {...{
                      isLoading,
                      setIsLoading,
                      users: students,
                      reload,
                      role: "student",
                    }}
                  />
                </div>
                {groupType === "class" ? (
                  <div className="grid grid-cols-1 space-y-5 md:grid-cols-2 md:space-y-0 md:gap-4">
                    <div className="space-y-5">
                      <p>Modules to add </p>
                      <ul className="max-h-[80%]  min-h-[50%] overflow-auto rounded-md border border-input bg-transparent px-3 py-2 ">
                        {modulesReady.map((module, index) => {
                          return (
                            <li
                              key={`${module.moduleId}-${index}`}
                              className="flex items-center gap-2"
                            >
                              <div className="flex-grow">
                                {module.moduleName}
                              </div>
                              <Button
                                type="button"
                                variant={"ghost"}
                                className="p-0"
                                onClick={() => handleAddModule(module)}
                              >
                                <Check color="green" />
                              </Button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                    <div className="space-y-5">
                      <p>Modules selected </p>
                      <ul className="max-h-[80%]  min-h-[50%] overflow-auto rounded-md border border-input bg-transparent px-3 py-2 ">
                        {seletcedModules.map((module, index) => {
                          return (
                            <li
                              key={`${module.moduleId}-${index}`}
                              className="flex items-center gap-2"
                            >
                              <div className="flex-grow">
                                {module.moduleName}
                              </div>
                              {module.locked ? (
                                <Button
                                  type="button"
                                  variant={"ghost"}
                                  className="p-0"
                                  onClick={() => handleUnlock(module)}
                                >
                                  <Lock />
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  variant={"ghost"}
                                  className="p-0"
                                  onClick={() => handleLock(module)}
                                >
                                  <Unlock />
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant={"ghost"}
                                className="p-0"
                                onClick={() => handleRemoveModule(module)}
                              >
                                <X color="red" />
                              </Button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                    <Button
                      type="button"
                      variant="default"
                      className="p-0"
                      disabled={disAbleModuleSave || isLoading}
                      onClick={async () => await handleSaveModules()}
                    >
                      Save Module Changes
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ) : null}
        {data ? (
          <div className="flex justify-end w-full my-8">
            <DeleteGroup
              {...{
                group: data,
                handleChangeGroup,
                isLoading,
                setIsLoading,
                students: students,
                managers: managers,
              }}
            />
          </div>
        ) : null}
      </div>
    </>
  );
};

export default ManageGroup;
