import {
  FC,
  FormEvent,
  useId,
  useState,
  Dispatch,
  SetStateAction,
  useEffect,
} from "react";
import  { AxiosError } from "axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { toast, useToast } from "./ui/use-toast";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Check} from "lucide-react";

import RemoveStudentFromClass from "./removeStudentFromClass";
import {
  ClientErrorHandler,
  hasIntersection,
  myFilterArray,
  sameList,
} from "@/lib/utils";
import { Group, Module, User } from "@/models/db_schemas";
import { requestAPI } from "@/lib/request";
import {
  PostEnrollsReq,
  PutEnrollsReq,
  PutFamiliesReq,
  PutStudentModulesReq,
  batchGetGroupsResSchema,
  getGroupsResSechema,
  getModulesResSchema,
  putFamiliesResSchema,
} from "@/models/api_schemas";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { z } from "zod";
import { trimedNonEmptyString } from "@/models/utlis_schemas";
import Loading from "./Loading";


interface ManageStudentProps {
  student: User;
  reload: () => Promise<void>;
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
}

export const ManageStudent: FC<ManageStudentProps> = (props) => {
  const { student, reload, isLoading, setIsLoading } = props;
  const { toast } = useToast();
  const [all_modules, setAllModules] = useState<Module[]>([]);
  const [available_modules,setAvailableModules]= useState<Module[]>([])
  const [enrolling, setEnrolling] = useState<Group>();
  const [families, setFamilies] = useState<Group[]>([]);

  useEffect(() => {
    setIsLoading(true)
    try {
      //find all moules and groups
      requestAPI("modules", "GET", { module_id: [] }, {})
        .then((data) => getModulesResSchema.parse(data))
        .then((modules) => {
          const {included,excluded} = myFilterArray(modules,(val)=>student.available_modules.includes(val.module_id))
          setAllModules(modules)
          setAvailableModules(included)
        });
      if (student.enrolled) {
        requestAPI("groups", "GET", {}, {}, student.enrolled)
          .then((data) => getGroupsResSechema.parse(data))
          .then((group) => setEnrolling(group));
      }
      if (student.families.length) {
        requestAPI("groups", "GET", { group_ids: student.families }, {})
          .then((data) => batchGetGroupsResSchema.parse(data))
          .then((groups) => setFamilies([...groups]));
      }
    } catch (error) {
      const handler = new ClientErrorHandler(error);
      handler.log();
      toast({
        variant: "destructive",
        title: "Init Error",
        description: handler.message,
      });
    }
    setIsLoading(false)
  }, []);

  // useEffect(()=>{
  //   console.log(families)
  // },[families])

  return (
    <>
      <div className="space-y-10">
        <div className=" flex  space-x-3 ">
          <p>Enrolled Class: </p>
          {student.enrolled ? (
            enrolling ? (
              <p>{`${enrolling.group_name} (${enrolling.group_id})`}</p>
            ) : (
              <Loading />
            )
          ) : (
            <p className="font-bold text-destructive">None</p>
          )}
        </div>
        <div>
          {student.enrolled ? (
            enrolling ? (
              <div className="space-x-4">
                <ChangeClass
                  {...{
                    ...props,
                    group_name: enrolling.group_name,
                  }}
                />
                <RemoveStudentFromClass
                  {...{
                    ...props,
                    group_name: enrolling.group_name,
                    display: `Disenroll student`,
                  }}
                />
              </div>
            ) : (
              <Loading />
            )
          ) : (
            <NewEnroll {...props} />
          )}
        </div>
        <ManageFamilies
          {...{
            ...props,
            families,
          }}
        />
        <ManageModules
          {...{
            ...props,
            available_modules,
            all_modules
          }}
        />
      </div>
    </>
  );
};

interface ChangeClassProps {
  student: User;
  reload: () => Promise<void>;
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  group_name: string;
}

const ChangeClass: FC<ChangeClassProps> = (props) => {
  const { student, reload, isLoading, setIsLoading, group_name } = props;
  const [classId, setClassId] = useState<string>("");
  const [message, setMessage] = useState<string>("");

  const { toast } = useToast();
  const newClass = useId();
  const oldClass = useId();
  const handleChange = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!student.enrolled) return;
    setMessage("");
    setIsLoading(true);
    const id = classId.trim();
    if (id.length === 0) {
      setMessage("Please provide the new class ID.");
      setClassId("");
    } else if (id === student.enrolled) {
      setMessage("The new class ID can not same as the old ID.");
    } else {
      //can remove capacity and class id validation if needed
      try {
        const data = await requestAPI("groups", "GET", {}, {}, id);
        const target = getGroupsResSechema.parse(data);
        if (target.type !== "class") {
          setMessage("Target is not a class.");
          setClassId("");
          setIsLoading(false);
          return;
        }
        if (target.students.length + 1 > target.capacity) {
          setMessage("Class is full.");
          setClassId("");
          setIsLoading(false);
          return;
        }
      } catch (error: any) {
        if (error instanceof AxiosError && error.response?.status === 404) {
          setMessage("Invalid class ID.");
        } else {
          const handler = new ClientErrorHandler(error);
          handler.log();
          toast({
            variant: "destructive",
            title: "Search Class Error",
            description: handler.message,
          });
        }
        setIsLoading(false);
        return;
      }
      try {
        //class will be updated by the api
        const payload: PutEnrollsReq = {
          email: student.email,
          group_id: id,
        };
        setClassId("");
        const response = await requestAPI("enrolls", "PUT", {}, payload);
        toast({
          title: "Updated",
        });
        await reload();
      } catch (error: any) {
        const handler = new ClientErrorHandler(error);
        handler.log();
        toast({
          variant: "destructive",
          title: "Update error",
          description: handler.message,
        });
      }
    }
    setIsLoading(false);
  };
  return (
    <>
      <Dialog>
        <DialogTrigger asChild>
          <Button disabled={isLoading}>
            {isLoading ? "loading..." : "Change class"}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleChange}>
            <DialogHeader>
              <DialogTitle>Change class</DialogTitle>
              <DialogDescription>
                {`Change the class of ${student.name}. Click save when you are done.`}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-6 items-center gap-4 ">
                <Label htmlFor={oldClass} className="text-right col-span-2 ">
                  Current class
                </Label>
                <div id={oldClass} className=" col-span-4">
                  {" "}
                  {group_name}
                </div>
              </div>
              <div className="grid grid-cols-6 items-center gap-x-4 gap-y-1 ">
                <Label htmlFor={newClass} className="text-right col-span-2 ">
                  New class ID
                </Label>
                <Input
                  id={newClass}
                  value={classId}
                  placeholder="new class ID ..."
                  onChange={(e) => {
                    setMessage("");
                    setClassId(e.target.value);
                  }}
                  className="col-span-4"
                />
                <div className=" col-span-6 text-right text-sm text-red-500">
                  {message}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Loading..." : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

interface NewEnrollProps {
  student: User;
  reload: () => Promise<void>;
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
}

const NewEnroll: FC<NewEnrollProps> = (props) => {
  const { student, reload, isLoading, setIsLoading } = props;
  const [classId, setClassId] = useState<string>("");
  const [message, setMessage] = useState<string>("");

  const { toast } = useToast();
  const newClass = useId();

  const handleEnroll = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage("");
    setIsLoading(true);
    const id = classId.trim();
    if (id.length === 0) {
      setMessage("Please provide a nonempty class ID.");
      setClassId("");
    } else {
      //can remove capacity and class id validation if needed
      try {
        const data = await requestAPI("groups", "GET", {}, {}, id);
        const target = getGroupsResSechema.parse(data);
        if (target.type !== "class") {
          setMessage("Target is not a class.");
          setClassId("");
          setIsLoading(false);
          return;
        }
        if (target.students.length + 1 > target.capacity) {
          setMessage("Class is full.");
          setClassId("");
          setIsLoading(false);
          return;
        }
      } catch (error: any) {
        if (error instanceof AxiosError && error.response?.status === 404) {
          setMessage("Invalid class ID.");
        } else {
          const handler = new ClientErrorHandler(error);
          handler.log();
          toast({
            variant: "destructive",
            title: "Search Class Error",
            description: handler.message,
          });
        }
        setIsLoading(false);
        return;
      }
      try {
        const payload: PostEnrollsReq = {
          email: student.email,
          group_id: id,
        };
        setClassId("");
        const update = await requestAPI("enrolls", "POST", {}, payload);
        toast({
          title: "Updated",
        });
        await reload();
      } catch (error: any) {
        const handler = new ClientErrorHandler(error);
        handler.log();
        toast({
          variant: "destructive",
          title: "Update error",
          description: handler.message,
        });
      }
    }
    setIsLoading(false);
  };

  return (
    <>
      <Dialog>
        <DialogTrigger asChild>
          <Button disabled={isLoading}>
            {isLoading ? "loading..." : "Enroll in class"}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleEnroll}>
            <DialogHeader>
              <DialogTitle>Enroll in class</DialogTitle>
              <DialogDescription>
                {`Enroll class for ${student.name}. Click save when you are done.`}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-6 items-center gap-x-4 gap-y-1 ">
                <Label htmlFor={newClass} className="text-right col-span-2 ">
                  Group ID
                </Label>
                <Input
                  id={newClass}
                  value={classId}
                  placeholder="new class ID ..."
                  onChange={(e) => {
                    setMessage("");
                    setClassId(e.target.value);
                  }}
                  className="col-span-4"
                />
                <div className=" col-span-6 text-right text-sm text-red-500">
                  {message}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Loading..." : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

interface ManageFamiliesProps {
  student: User;
  reload: () => Promise<void>;
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  families: Group[];
}

const classFromSchema = z.object({
  families_ids_str: trimedNonEmptyString,
});

type ManageFamiliesForm = z.infer<typeof classFromSchema>;

const ManageFamilies: FC<ManageFamiliesProps> = (props) => {
  const { student, reload, setIsLoading, isLoading, families } = props;
  const [displaying, setDisplaying] = useState<Group[]>(families);
  const [removed, SetRemoved] = useState<Group[]>([]);
  const famIds = families.map((f) => f.group_id);
  const displayingIds = displaying.map((f) => f.group_id);
  const disableSave: boolean = sameList(famIds, displayingIds);
  const famToBeAdded = displaying.filter(
    (group) => !famIds.includes(group.group_id)
  );
  const famToBeRemoved = removed.filter((group) =>
    famIds.includes(group.group_id)
  );

  const { toast } = useToast();

  const form = useForm<ManageFamiliesForm>({
    resolver: zodResolver(classFromSchema),
    defaultValues: {
      families_ids_str: "",
    },
  });

  const handleUnRemove = async (target: Group) => {
    SetRemoved((prev) =>
      prev.filter((group) => group.group_id !== target.group_id).sort()
    );
    setDisplaying((prev) => [...prev, target]);
  };

  const handleRemove = (toRemove: Group) => {
    SetRemoved((prev) => [...prev, toRemove].sort());
    setDisplaying((prev) =>
      prev.filter((group) => group.group_id !== toRemove.group_id).sort()
    );
  };
  const handleAddNew = async (values: ManageFamiliesForm) => {
    const ids = values.families_ids_str
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length);
    if (!ids.length) {
      form.setError("families_ids_str", { message: "Required" });
      return;
    }
    if (hasIntersection(ids, famIds)) {
      const message = `Some groups are already included.`;
      form.setError("families_ids_str", { message });
      return;
    }
    try {
      setIsLoading(true);
      const data = await requestAPI(
        "groups",
        "GET",
        {
          group_ids: ids,
          type: ["family"],
          exact: "true",
        },
        {}
      );
      const groups = batchGetGroupsResSchema.parse(data);
      setIsLoading(false);
      form.reset();
      setDisplaying((prev) => [...prev, ...groups]);
    } catch (error: any) {
      const handler = new ClientErrorHandler(error);
      if (handler.isAxiosError && handler.status_code === 404) {
        const message = handler.message.split(":")[1] ?? "Invalid group ids.";
        form.setError("families_ids_str", { message });
      } else {
        handler.log();
        toast({
          variant: "destructive",
          title: "Search Class Error",
          description: handler.message,
        });
      }
      setIsLoading(false);
      return;
    }
  };

  const handleAssignClass = async () => {
    if (disableSave || isLoading) return;
    if (!famToBeRemoved.length && !famToBeAdded.length) return;
    form.clearErrors();
    setIsLoading(true);
    try {
      const payload: PutFamiliesReq = {
        email: student.email,
        toAdd: famToBeAdded.map((fam) => fam.group_id),
        toRemove: famToBeRemoved.map((fam) => fam.group_id),
      };
      const data = await requestAPI("families", "PUT", {}, payload);
      const updated = putFamiliesResSchema.parse(data);
      toast({
        title: "Updated",
      });
      SetRemoved([]);
      await reload();
    } catch (error: any) {
      const handler = new ClientErrorHandler(error);
      handler.log();
      toast({
        variant: "destructive",
        title: "Update User Error",
        description: handler.message,
      });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    setDisplaying([...families]);
  }, [families]);

  return (
    <>
      {/* {JSON.stringify(families)} */}

      <div className=" space-y-5 w-2/3">
        <p>Current families </p>
        <div className=" min-h-[40px] w-full rounded-md border border-input bg-transparent px-3 py-2 ">
          <ul>
            {displaying.map((group, index) => {
              return (
                <li
                  key={`${group.group_id}-${index}`}
                  className="flex items-center gap-2"
                >
                  <div className="flex-grow">{`${group.group_name} (${group.group_id})`}</div>

                  <Button
                    variant={"ghost"}
                    className="p-0"
                    onClick={() => handleRemove(group)}
                  >
                    <X color="red" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
        <p>Families to be removed</p>
        <div className=" min-h-[40px] w-full rounded-md border border-input bg-transparent px-3 py-2 ">
          <ul>
            {removed.map((group, index) => {
              return (
                <li
                  key={`${group.group_id}-${index}`}
                  className="flex items-center gap-2"
                >
                  <div className="flex-grow">{`${group.group_name} (${group.group_id})`}</div>
                  <Button
                    variant={"ghost"}
                    className="p-0"
                    onClick={() => handleUnRemove(group)}
                  >
                    <Check color="green" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleAddNew)} className="">
            <FormField
              control={form.control}
              name="families_ids_str"
              render={({ field }) => (
                <FormItem className="">
                  <FormLabel>New families: </FormLabel>
                  <div className="flex items-center">
                    <FormControl>
                      <Input placeholder="Group IDs..." {...field} />
                    </FormControl>
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
                        {isLoading ? "loading..." : "Add"}
                      </Button>
                    </FormControl>
                  </div>
                  <FormDescription>{`Seperate class IDs by "," .`}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={isLoading || disableSave}>
              {isLoading ? "loading..." : "Save family changes"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Are you sure to update the families of {student.name} ?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone.{" "}
                {famToBeRemoved.length
                  ? `This will permanently remove ${famToBeRemoved
                      .map((g) => g.group_name)
                      .join(", ")} from the family list of ${student.name}.`
                  : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={isLoading}
                onClick={handleAssignClass}
              >
                {isLoading ? "Loading..." : "Confirm"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
};

interface ManageModulesProps {
  student: User;
  reload: () => Promise<void>;
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  available_modules:Module[];
  all_modules: Module[];
}

const ManageModules: FC<ManageModulesProps> = (props) => {
  const { student, reload, isLoading, setIsLoading,available_modules,all_modules } = props;
  const available_modules_ids = available_modules.map(m=>m.module_id)
  const [displaying, setDisplaying] = useState<Module[]>(available_modules);
  const displayingIds = displaying.map((m) => m.module_id);
  const modulesToAdd = all_modules.filter(
    (m) => !displayingIds.includes(m.module_id)
  );
  const disableSave = sameList(available_modules_ids, displayingIds);

  const handleRemove = (id: string) => {
    setDisplaying((prev) => prev.filter((m) => m.module_id !== id));
  };

  const handleAdd = (module: Module) => {
    setDisplaying((prev) => [...prev, module]);
  };

  const handleSave = async () => {
    const toAdd = displayingIds.filter((id) =>!available_modules_ids.includes(id));
    const toRemove = available_modules_ids.filter((id) => !displayingIds.includes(id));
    setIsLoading(true);
    try {
      const payload: PutStudentModulesReq = {
        email: student.email,
        toAdd,
        toRemove,
      };
      const data = await requestAPI(
        "students-available-modules",
        "PUT",
        {},
        payload
      );
      const updated = putFamiliesResSchema.parse(data);
      toast({
        title: "Updated",
      });
      await reload();
    } catch (error: any) {
      const handler = new ClientErrorHandler(error);
      handler.log();
      toast({
        variant: "destructive",
        title: "Update User Error",
        description: handler.message,
      });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    setDisplaying(available_modules)
  },[available_modules]);

  return (
    <>
      <div className=" space-y-5 col-span-2">
        <p>Current modules</p>
        <div className=" min-h-[40px] w-full rounded-md border border-input bg-transparent px-3 py-2 ">
          <ul>
            {displaying.map((module, index) => {
              return (
                <li
                  key={`${module.module_id}-${index}`}
                  className="flex items-center gap-2"
                >
                  <div className="flex-grow">{module.module_name}</div>
                  <Button
                    variant={"ghost"}
                    className="p-0"
                    onClick={() => handleRemove(module.module_id)}
                  >
                    <X color="red" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
        <p>Modules to add</p>
        <div className=" min-h-[40px] w-full rounded-md border border-input bg-transparent px-3 py-2 ">
          <ul>
            {modulesToAdd.map((module, index) => {
              return (
                <li
                  key={`${module.module_id}-${index}`}
                  className="flex items-center gap-2"
                >
                  <div className="flex-grow">{module.module_name}</div>
                  <Button
                    variant={"ghost"}
                    className="p-0"
                    onClick={() => handleAdd(module)}
                  >
                    <Check color="green" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
        <Button disabled={isLoading || disableSave} onClick={handleSave}>
          {isLoading ? "loading..." : "Save module changes"}
        </Button>
      </div>
    </>
  );
};
