import {
  FC,
  FormEvent,
  useId,
  useState,
  Dispatch,
  SetStateAction,
  useEffect,
} from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "./ui/button";
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
import { X, Check } from "lucide-react";

import { ClientErrorHandler, hasIntersection, sameList } from "@/lib/utils";
import { Group, Module, User } from "@/models/db_schemas";
import { requestAPI } from "@/lib/request";

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
import {
  PutUserEnrollsReq,
  PutUserModulesReq,
  batchGetGroupsByIdResSchema,
  getModulesResSchema,
  getUserEnrollsResSchema,
  getUserModulesResSchema,
} from "@/models/api_schemas";

interface ManageStudentProps {
  student: User;
  reload: () => Promise<void>;
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
}

// get all modules
function getAllModules() {
  return requestAPI("modules", "GET", { module_id: [] }, {}).then((data) =>
    getModulesResSchema.parse(data)
  );
}

//get the modules of students
function getStudentModules(email: string) {
  return requestAPI(
    "user-modules",
    "GET",
    {
      email,
    },
    {}
  ).then((data) => getUserModulesResSchema.parse(data));
}

// get the enrolled grps

function getEnrolledGroups(email: string) {
  return requestAPI("user-enrolls", "GET", {
    email,
  }, {}).then((data) =>
    getUserEnrollsResSchema.parse(data)
  );
}

export const ManageStudent: FC<ManageStudentProps> = (props) => {
  const { student, reload, isLoading, setIsLoading } = props;
  const { toast } = useToast();
  const [all_modules, setAllModules] = useState<Module[]>([]);
  const [available_modules, setAvailableModules] = useState<Module[]>([]);
  const [enrolling, setEnrolling] = useState<Group[]>([]);

  useEffect(() => {
    setIsLoading(true);
    try {
      Promise.all([
        getAllModules(),
        getStudentModules(student.email),
        getEnrolledGroups(student.email),
      ]).then((values) => {
        const [all_modules, available_modules, enrolling] = values;
        const available = all_modules.filter((m) =>
          available_modules.includes(m.moduleId)
        );
        setAllModules(all_modules);
        setAvailableModules(available);
        setEnrolling(enrolling);
      });
    } catch (error) {
      const handler = new ClientErrorHandler(error);
      handler.log();
      toast({
        variant: "destructive",
        title: "Init Error",
        description: handler.message,
      });
    }
    setIsLoading(false);
  }, [setIsLoading, student, student.email, student.role, toast]);

  // useEffect(()=>{
  //   console.log(families)
  // },[families])

  return (
    <>
      <div className="space-y-10">
        <ManageEnrolled
          {...{
            ...props,
            enrolled: enrolling,
          }}
        />
        <ManageModules
          {...{
            ...props,
            available_modules,
            all_modules,
          }}
        />
      </div>
    </>
  );
};

interface ManageEnrolledProps {
  student: User;
  reload: () => Promise<void>;
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  enrolled: Group[];
}

const classFromSchema = z.object({
  groups_ids_str: trimedNonEmptyString,
});

type ManageErnolledForm = z.infer<typeof classFromSchema>;

const ManageEnrolled: FC<ManageEnrolledProps> = (props) => {
  const { student, reload, setIsLoading, isLoading, enrolled } = props;
  const [displaying, setDisplaying] = useState<Group[]>(enrolled);
  const [removed, SetRemoved] = useState<Group[]>([]);
  const enrolledIds = enrolled.map((e) => e.groupId);
  const displayingIds = displaying.map((d) => d.groupId);
  const disableSave: boolean = sameList(enrolledIds, displayingIds);
  const grpsToBeAdded = displaying.filter(
    (group) => !enrolledIds.includes(group.groupId)
  );
  const grpsToBeRemoved = removed.filter((group) =>
    enrolledIds.includes(group.groupId)
  );

  const { toast } = useToast();

  const form = useForm<ManageErnolledForm>({
    resolver: zodResolver(classFromSchema),
    defaultValues: {
      groups_ids_str: "",
    },
  });

  const handleUnRemove = async (target: Group) => {
    SetRemoved((prev) =>
      prev.filter((group) => group.groupId !== target.groupId).sort()
    );
    setDisplaying((prev) => [...prev, target]);
  };

  const handleRemove = (toRemove: Group) => {
    SetRemoved((prev) => [...prev, toRemove].sort());
    setDisplaying((prev) =>
      prev.filter((group) => group.groupId !== toRemove.groupId).sort()
    );
  };
  const handleAddNew = async (values: ManageErnolledForm) => {
    const ids = values.groups_ids_str
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length);
    if (!ids.length) {
      form.setError("groups_ids_str", { message: "Required" });
      return;
    }
    if (hasIntersection(ids, enrolledIds)) {
      const message = `Some groups are already included.`;
      form.setError("groups_ids_str", { message });
      return;
    }
    try {
      setIsLoading(true);
      const data = await requestAPI(
        "groups",
        "GET",
        {
          group_id: ids,
        },
        {}
      );
      const groups = batchGetGroupsByIdResSchema.parse(data);
      setIsLoading(false);
      form.reset();
      setDisplaying((prev) => [...prev, ...groups]);
    } catch (error: any) {
      const handler = new ClientErrorHandler(error);
      if (handler.isAxiosError && handler.status_code === 404) {
        const message = handler.message.split(":")[1] ?? "Invalid group ids.";
        form.setError("groups_ids_str", { message });
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
    if (!grpsToBeAdded.length && !grpsToBeRemoved.length) return;
    form.clearErrors();
    setIsLoading(true);
    try {
      const payload: PutUserEnrollsReq = {
        email: student.email,
        add: grpsToBeAdded.map((fam) => fam.groupId),
        remove: grpsToBeRemoved.map((fam) => fam.groupId),
      };
      const data = await requestAPI("user-enrolls", "PUT", {}, payload);
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
    setDisplaying([...enrolled]);
  }, [enrolled]);

  return (
    <>
      {/* {JSON.stringify(families)} */}

      <div className=" space-y-5 w-2/3">
        <p>Current Enrolled Classes </p>
        <div className=" min-h-[40px] w-full rounded-md border border-input bg-transparent px-3 py-2 ">
          <ul>
            {displaying
              .filter((g) => g.type === "class")
              .map((group, index) => {
                return (
                  <li
                    key={`${group.groupId}-${index}`}
                    className="flex items-center gap-2"
                  >
                    <div className="flex-grow">{`${group.groupName} (${group.groupId})`}</div>

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
        <p>Classes to be removed</p>
        <div className=" min-h-[40px] w-full rounded-md border border-input bg-transparent px-3 py-2 ">
          <ul>
            {removed
              .filter((g) => g.type === "class")
              .map((group, index) => {
                return (
                  <li
                    key={`${group.groupId}-${index}`}
                    className="flex items-center gap-2"
                  >
                    <div className="flex-grow">{`${group.groupName} (${group.groupId})`}</div>
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
        <p>Current Families </p>
        <div className=" min-h-[40px] w-full rounded-md border border-input bg-transparent px-3 py-2 ">
          <ul>
            {displaying
              .filter((g) => g.type === "family")
              .map((group, index) => {
                return (
                  <li
                    key={`${group.groupId}-${index}`}
                    className="flex items-center gap-2"
                  >
                    <div className="flex-grow">{`${group.groupName} (${group.groupId})`}</div>

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
            {removed
              .filter((g) => g.type === "family")
              .map((group, index) => {
                return (
                  <li
                    key={`${group.groupId}-${index}`}
                    className="flex items-center gap-2"
                  >
                    <div className="flex-grow">{`${group.groupName} (${group.groupId})`}</div>
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
              name="groups_ids_str"
              render={({ field }) => (
                <FormItem className="">
                  <FormLabel>New Enrolls: </FormLabel>
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
                  <FormDescription>{`Seperate group IDs by "," .`}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={isLoading || disableSave}>
              {isLoading ? "loading..." : "Save enrollment changes"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Are you sure to update the enrolled groups of {student.name} ?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone.{" "}
                {grpsToBeRemoved.length
                  ? `This will permanently remove ${grpsToBeRemoved
                      .map((g) => g.groupName)
                      .join(", ")} from the enrolled group list of ${
                      student.name
                    }.`
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
  available_modules: Module[];
  all_modules: Module[];
}

const ManageModules: FC<ManageModulesProps> = (props) => {
  const {
    student,
    reload,
    isLoading,
    setIsLoading,
    available_modules,
    all_modules,
  } = props;
  const available_modules_ids = available_modules.map((m) => m.moduleId);
  const [displaying, setDisplaying] = useState<Module[]>(available_modules);
  const displayingIds = displaying.map((m) => m.moduleId);
  const modulesToAdd = all_modules.filter(
    (m) => !displayingIds.includes(m.moduleId)
  );
  const disableSave = sameList(available_modules_ids, displayingIds);

  const handleRemove = (id: string) => {
    setDisplaying((prev) => prev.filter((m) => m.moduleId !== id));
  };

  const handleAdd = (module: Module) => {
    setDisplaying((prev) => [...prev, module]);
  };

  const handleSave = async () => {
    const toAdd = displayingIds.filter(
      (id) => !available_modules_ids.includes(id)
    );
    const toRemove = available_modules_ids.filter(
      (id) => !displayingIds.includes(id)
    );
    setIsLoading(true);
    try {
      const payload: PutUserModulesReq = {
        email: student.email,
        add: toAdd,
        remove: toRemove,
      };
      const data = await requestAPI("user-modules", "PUT", {}, payload);
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
    setDisplaying(available_modules);
  }, [available_modules]);

  return (
    <>
      <div className=" space-y-5 col-span-2">
        <p>Current modules</p>
        <div className=" min-h-[40px] w-full rounded-md border border-input bg-transparent px-3 py-2 ">
          <ul>
            {displaying.map((module, index) => {
              return (
                <li
                  key={`${module.moduleId}-${index}`}
                  className="flex items-center gap-2"
                >
                  <div className="flex-grow">{module.moduleName}</div>
                  <Button
                    variant={"ghost"}
                    className="p-0"
                    onClick={() => handleRemove(module.moduleId)}
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
                  key={`${module.moduleId}-${index}`}
                  className="flex items-center gap-2"
                >
                  <div className="flex-grow">{module.moduleName}</div>
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
