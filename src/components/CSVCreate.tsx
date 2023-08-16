import { FC, useState, Dispatch, SetStateAction, useEffect } from "react";
import Papa from "papaparse";
import { z } from "zod";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "./ui/data-table";

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
import { Label } from "@radix-ui/react-label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import axios, { AxiosError } from "axios";

import { getOrdinal, ClientErrorHandler } from "@/lib/utils";
import { createUserInfoSchema,GetGroupsRes,GetModulesRes,getGroupsResSechema, postBatchCreateUsersResSchema, getModulesResSchema} from "@/models/api_schemas";
import { Module, userRoleSchema } from "@/models/db_schemas";
import {
  emailSchema,
  expirationDateStrSchema,
  trimedNonEmptyString,
} from "@/models/utlis_schemas";
import {requestAPI} from "@/lib/request"
import { Check, X } from "lucide-react";

type CSVData = {
  data: any[];
  errors: Papa.ParseError[];
  meta: Papa.ParseMeta | undefined;
};

type CSVRow = z.infer<typeof createUserInfoSchema>;

const columns: ColumnDef<CSVRow>[] = [
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    accessorKey: "name",
    header: "Name",
  },
];

interface CSVCreateProps {
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
}

const CSVCreate: FC<CSVCreateProps> = ({ isLoading, setIsLoading }) => {
  const [csvData, setCsvData] = useState<CSVData>({
    data: [],
    errors: [],
    meta: undefined,
  });
  const [errorMessage, setErrorMessage] = useState<string>("");

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setErrorMessage("");
    const file = event.target.files?.[0];
    // console.log(file)
    if (!file) {
      return;
    }

    let results = await new Promise<CSVData>((resolve) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: function (h) {
          h = h.trim().toLowerCase();
          switch (h) {
            case "name":
              return "name";
            case "email":
              return "email";
            default:
              return h;
          }
        },
        complete: (results: CSVData) => resolve(results),
      });
    });
    const missingFields = Object.keys(createUserInfoSchema.shape).filter(
      (field) => !results.meta?.fields?.includes(field)
    );
    if (missingFields.length) {
      setErrorMessage(
        `${missingFields.join(", ")} ${
          missingFields.length > 1 ? "are" : "is"
        } missing from file header.`
      );
      return;
    }
    let safe = true;
    results.data = results.data.map((row, index) => {
      if (!safe) return row;
      try {
        const user = createUserInfoSchema.parse(row);
        return user;
      } catch (error: any) {
        safe = false;
        if (error instanceof z.ZodError) {
          const { issues } = error;
          console.error(issues);
          setErrorMessage(
            `Fail to process the ${getOrdinal(
              index + 1
            )} data, messages: ${issues
              .map((issue, index) => {
                const { message, path } = issue;
                return `${index + 1}. ${message} in ${path.join(", ")}`;
              })
              .join(". ")}.`
          );
        }
      }
    });
    if (!safe) return;
    setCsvData(results);
  };

  return (
    <>
      <div className="grid w-full items-center gap-1.5">
        <Label htmlFor="picture">Account data:</Label>
        <Input
          id="picture"
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          className="max-w-sm  cursor-pointer"
        />
        <p className="text-sm text-muted-foreground">{`Please upload a CSV file that includes the following headers:
      'Name', and 'Email'. All three headers are required and must be present in the CSV file. 
      Please ensure that your CSV file is formatted correctly before uploading.`}</p>
        <p className="text-sm font-medium text-destructive">{errorMessage}</p>
      </div>
      {csvData.data.length ? (
        <div className="grid grid-cols-2 gap-4">
          <DataTable columns={columns} data={csvData.data} pageSize={5} />
          <Create {...{ setIsLoading, isLoading, users: csvData.data }} />
        </div>
      ) : null}
      {/* <pre>{JSON.stringify(csvData,null,3)}</pre> */}
    </>
  );
};

const formSchema = z
  .object({
    role: userRoleSchema,
    enrolled: z.string().trim(),
    managing_str: z.string().trim(),
    families_str: z.string().trim(),
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

type formType = z.infer<typeof formSchema>;

interface formProps {
  users: CSVRow[];
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
}
const Create: FC<formProps> = ({ isLoading, setIsLoading, users }) => {
  const [allModules, setAllModules] = useState<Module[]>([]);
  const [seletcedModules, setSelectedModules] = useState<Module[]>([]);
  const modulesToAdd = allModules.filter(
    (m) => !seletcedModules.map((s) => s.module_id).includes(m.module_id)
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
      prev.filter((m) => m.module_id !== target.module_id)
    );
  };

  const handleResetModules = () => {
    setSelectedModules([]);
  };


  const form = useForm<formType>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      role: undefined,
      enrolled: "",
      managing_str: "",
      families_str: "",
      expiration_date: "",
    },
  });

  const onSubmit = async (values: formType) => {
    setIsLoading(true);
    try {
      const {
        role,
        enrolled,
        managing_str,
        families_str,
        expiration_date,
      } = values;
      const isStudent = role == "student";
      const canManage = role === "parent" || role === "teacher";
      const isAdmin = role === "admin";
      const toEnroll = isStudent&&enrolled.length ? enrolled.trim() : undefined;
      const managing = canManage
        ? managing_str
            .split(",")
            .map((id) => id.trim())
            .filter((id) => id.length)
        : null;
      const families = isStudent
        ? families_str
            .split(",")
            .map((id) => id.trim())
            .filter((id) => id.length)
        : null;
      if (managing?.length) {
        try {
          //class id valiadation will also be done in api
          const groups = await requestAPI(
            "groups",
            "GET",
            {
              group_ids: managing,
              type: role === "parent" ? "family" : "class",
            },
            {}
          );
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
      if (toEnroll) {
        try {
          //class id will also be done on api
          const group = await requestAPI("groups", "GET", {}, {}, toEnroll);
          const target = getGroupsResSechema.parse(group);
          //capacity check will also be done on api
          if (target.students.length + users.length >= target.capacity) {
            form.setError("enrolled", { message: "Class is full." });
            setIsLoading(false);
            return;
          }
        } catch (error: any) {
          if (error instanceof AxiosError && error.response?.status === 404) {
            form.setError("enrolled", {
              message: `${enrolled} is not a valid class ID`,
            });
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
      }
      if (families?.length) {
        try {
          //class id valiadation will also be done in api
          const groups = await requestAPI(
            "groups",
            "GET",
            {
              group_ids: families,
              type: "family",
            },
            {}
          );
        } catch (error: any) {
          const handler = new ClientErrorHandler(error);
          if (handler.isAxiosError && handler.status_code === 404) {
            form.setError("families_str", {
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
        users,
        role,
        expiration_date: isAdmin ? null : expiration_date,
        enrolled: toEnroll,
        families,
        managing,
        available_modules: isStudent ? seletcedModules.map(m=>m.module_id) : null,
      };
      // console.log(userData)
      //class update will be handled by api
      const data = postBatchCreateUsersResSchema.parse(
        await requestAPI("batch-create-users", "POST", {}, userData)
      );
      // console.log(data)
      form.reset();
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
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
          {form.watch("role") && form.watch("role") === "student" ? (
            <>
              <FormField
                control={form.control}
                name="enrolled"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Enrolled Class ID</FormLabel>
                    <FormControl>
                      <Input placeholder="Class ID..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="families_str"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Families</FormLabel>
                    <FormControl>
                      <Input placeholder="Groups IDs..." {...field} />
                    </FormControl>
                    <FormDescription>{`Seperate group IDs by "," .`}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <div className="grid grid-cols-1 space-y-4">
                <div className="space-y-5">
                  <p>Modules to add </p>
                  <ul className="max-h-[90%] min-h-[60%]  overflow-auto rounded-md border border-input bg-transparent px-3 py-2 ">
                    {modulesToAdd.map((module, index) => {
                      return (
                        <li
                          key={`${module.module_id}-${index}`}
                          className="flex items-center gap-2"
                        >
                          <div className="flex-grow">{module.module_name}</div>
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
                  <ul className="max-h-[90%] min-h-[60%]  overflow-auto rounded-md border border-input bg-transparent px-3 py-2 ">
                    {seletcedModules.map((module, index) => {
                      return (
                        <li
                          key={`${module.module_id}-${index}`}
                          className="flex items-center gap-2"
                        >
                          <div className="flex-grow">{module.module_name}</div>
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

export default CSVCreate;
