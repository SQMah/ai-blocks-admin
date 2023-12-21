import { FC, Dispatch, SetStateAction, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "./ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { ClientErrorHandler } from "@/lib/utils";
import { Module, userRoleSchema } from "@/models/db_schemas";
import {
  emailSchema,
  expirationDateStrSchema,
  trimedNonEmptyString,
} from "@/models/utlis_schemas";
import { requestAPI } from "@/lib/request";
import {
  PostUsersReq,
  batchGetGroupsByIdResSchema,
  getModulesResSchema,
  postUsersResSchema,
} from "@/models/api_schemas";
import { X, Check } from "lucide-react";

interface ManualCreateProps {
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
}

const UserCreateFormSchema = z
  .object({
    role: userRoleSchema,
    email: emailSchema,
    name: trimedNonEmptyString,
    managing_str: z.string().trim(),
    enrolling_str: z.string().trim(),
    expiration_date: expirationDateStrSchema.or(z.literal("")),
  })
  .refine(
    (input) => {
      if (input.role !== "admin") {
        return input.expiration_date?.length;
      } else return true;
    },
    { path: ["expiration_date"], message: `Expiration date is required` }
  );

type UserCreateFormType = z.infer<typeof UserCreateFormSchema>;

const ManualCreate: FC<ManualCreateProps> = ({ isLoading, setIsLoading }) => {
  const [allModules, setAllModules] = useState<Module[]>([]);
  const [seletcedModules, setSelectedModules] = useState<Module[]>([]);
  const modulesToAdd = allModules.filter(
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

  const handleAddModule = (module: Module) => {
    setSelectedModules((prev) => [...prev, module]);
  };
  const handleRemoveModule = (target: Module) => {
    setSelectedModules((prev) =>
      prev.filter((m) => m.moduleId !== target.moduleId)
    );
  };

  const handleResetModules = () => {
    setSelectedModules([]);
  };

  const form = useForm<UserCreateFormType>({
    resolver: zodResolver(UserCreateFormSchema),
    defaultValues: {
      email: "",
      name: "",
      enrolling_str: "",
      managing_str: "",
      expiration_date: "",
    },
  });

  const onSubmitManual = async (values: UserCreateFormType) => {
    setIsLoading(true);
    try {
      const {
        role,
        email,
        name,
        managing_str,
        enrolling_str,
        expiration_date,
      } = values;
      const isStudent = role == "student";
      const canManage = role === "parent" || role === "teacher";
      const isAdmin = role === "admin";
      const enrolling = isStudent
        ? enrolling_str
            .split(",")
            .map((id) => id.trim())
            .filter((id) => id.length)
        : null;
      const managing = canManage
        ? managing_str
            .split(",")
            .map((id) => id.trim())
            .filter((id) => id.length)
        : null;

      if (managing?.length) {
        try {
          //class id valiadation will also be done in api
          const data = await requestAPI(
            "groups",
            "GET",
            {
              group_id: managing,
            },
            {}
          );
          const groups = batchGetGroupsByIdResSchema.parse(data);
          const unmatched = managing.filter(
            (id) => !groups.map((g) => g.groupId).includes(id)
          );
          if (unmatched.length) {
            form.setError("managing_str", {
              message: `Groups ${unmatched.join(",")} does not exist`,
            });
            setIsLoading(false);
            return;
          }

        } catch (error: any) {
          const handler = new ClientErrorHandler(error);
          if (handler.isAxiosError && handler.status_code === 404) {
            form.setError("managing_str", {
              message: handler.message.split(":")[1],
            });
            setIsLoading(false);
            return;
          }
          handler.log();
          toast({
            title: "Search error",
            description: handler.message,
          });
          setIsLoading(false);
          return;
        }
      }
      if (enrolling?.length) {
        try {
          //class id valiadation will also be done in api
          const data = await requestAPI(
            "groups",
            "GET",
            {
              group_id: enrolling,
            },
            {}
          );
          const groups = batchGetGroupsByIdResSchema.parse(data);
          const unmatched = enrolling.filter(
            (id) => !groups.map((g) => g.groupId).includes(id)
          );
          if (unmatched.length) {
            form.setError("enrolling_str", {
              message: `Groups ${unmatched.join(",")} does not exist`,
            });
            setIsLoading(false);
            return;
          }
          const outQuota = groups.filter(group=>{
            if(group.type === "class" ){
              const remaining = group.capacity - group.studentCount
              return remaining <1
            }
            return false
          })
          if(outQuota.length){
            form.setError("enrolling_str", {
              message: `Class ${outQuota.map(g=>g.groupId).join(",")} is out of capacity`,
            });
            setIsLoading(false);
            return;
          }
        } catch (error: any) {
          const handler = new ClientErrorHandler(error);
          if (handler.isAxiosError && handler.status_code === 404) {
            form.setError("enrolling_str", {
              message: handler.message.split(":")[1],
            });
            setIsLoading(false);
            return;
          }
          handler.log();
          toast({
            title: "Search error",
            description: handler.message,
          });
          setIsLoading(false);
          return;
        }
      }
      const userData = {
        role,
        email,
        name,
        expiration_date: isAdmin ? null : expiration_date,
        enrolling,
        managing,
        available_modules: isStudent
          ? seletcedModules.map((m) => m.moduleId) ?? []
          : null,
      };
      // console.log(userData)
      //class update will be handled by api
      const data =  await requestAPI("users", "POST", {}, userData)
      // console.log(data)
      const created = postUsersResSchema.parse(data)
      form.reset();
      handleResetModules();
      toast({
        title: "Created",
      });
      // console.log(data.messages);
    } catch (error: any) {
      const handler = new ClientErrorHandler(error);
      handler.log();
      toast({
        variant: "destructive",
        title: "Creation error",
        description: handler.message,
      });
    }
    setIsLoading(false);
  };

  return (
    <>
      {/* {isLoading?1:0} */}
      <Form {...form}>
        <form
          // onSubmit={form.handleSubmit(onSubmitManual)}
          onSubmit={form.handleSubmit(onSubmitManual)}
          className="space-y-8"
        >
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Account type</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an account type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="teacher">Teacher account</SelectItem>
                    <SelectItem value="student">Student account</SelectItem>
                    <SelectItem value="parent">Parent account</SelectItem>
                    <SelectItem value="admin">Admin account</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          {form.watch("role") ? (
            <>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email {`(${form.watch("role")} ID)`}</FormLabel>
                    <FormControl>
                      <Input placeholder="Email..." type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-5">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </>
          ) : null}
          {form.watch("role") && form.watch("role") === "student" ? (
            <>
              <FormField
                control={form.control}
                name="enrolling_str"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Erolling Groups</FormLabel>
                    <FormControl>
                      <Input placeholder="Groups IDs..." {...field} />
                    </FormControl>
                    <FormDescription>{`Seperate group IDs by "," .`}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 space-y-5 md:grid-cols-2 md:space-y-0 md:gap-4">
                <div className="space-y-5">
                  <p>Modules to add </p>
                  <ul className="max-h-[90%] min-h-[60%]  overflow-auto rounded-md border border-input bg-transparent px-3 py-2 ">
                    {modulesToAdd.map((module, index) => {
                      return (
                        <li
                          key={`${module.moduleId}-${index}`}
                          className="flex items-center gap-2"
                        >
                          <div className="flex-grow">{module.moduleName}</div>
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
                  <ul className="max-h-[90%] min-h-[60%] overflow-auto rounded-md border border-input bg-transparent px-3 py-2 ">
                    {seletcedModules.map((module, index) => {
                      return (
                        <li
                          key={`${module.moduleId}-${index}`}
                          className="flex items-center gap-2"
                        >
                          <div className="flex-grow">{module.moduleName}</div>
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
              </div>
            </>
          ) : null}
          {form.watch("role") &&
          (form.watch("role") === "teacher" ||
            form.watch("role") === "parent") ? (
            <>
              <FormField
                control={form.control}
                name="managing_str"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Managing groups</FormLabel>
                    <FormControl>
                      <Input placeholder="group IDs..." {...field} />
                    </FormControl>
                    <FormDescription>{`Seperate group IDs by "," .`}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          ) : null}
          {form.watch("role") && form.watch("role") !== "admin" ? (
            <>
              <FormField
                control={form.control}
                name="expiration_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account expiration</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Expiration date"
                        type="date"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          ) : null}
          <div className="flex justify-end">
            {form.watch("role") ? (
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Loading..." : "Submit"}
              </Button>
            ) : null}
          </div>
        </form>
      </Form>
    </>
  );
};

export default ManualCreate;
