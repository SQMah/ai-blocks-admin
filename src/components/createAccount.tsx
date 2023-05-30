import { FC, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
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
import axios from "axios";

import { role_to_roleName} from "@/models/auth0_schemas";
import { PostUsersResSchema, UserCreateSchema,UserCreateType } from "@/models/api_schemas";
import { PostUsersReqSchema } from "@/models/api_schemas";

const ManualCreate: FC = () => {
  const [isLaoding, setLoading] = useState<boolean>(false);

  const form = useForm<UserCreateType>({
    resolver: zodResolver(UserCreateSchema),
    defaultValues: {
      email: "",
      first_name: "",
      last_name: "",
      classId: "",
      expiration: "",
    },
  });

  const onSubmitManual = async (values: UserCreateType) => {
    setLoading(true)
    try {
      const payload= PostUsersReqSchema.parse( { users: [values] });
      // console.log(payload)
      const response = await axios.post("/api/users", payload);
      const data = PostUsersResSchema.parse(response.data)
      // console.log(data.messages);
    } catch (error: any) {
      console.log(error?.response?.data?.message??error?.message??error)
    }
    setLoading(false)
  };

  useEffect(() => {
    const role = form.watch("role");
    const classId = form.watch("classId");
    const expiration = form.watch("expiration");
    if ((role === "admin" || role === "unmanagedStudent") && !classId.length) {
      form.setValue("classId", "...");
    } else if (
      (role === "managedStudent" || role === "teacher") &&
      !form.formState.dirtyFields.classId
    ) {
      form.setValue("classId", "");
    }
    if (role === "admin" && !expiration.length) {
      form.setValue("expiration", "...");
    } else if (role !== "admin" && !form.formState.dirtyFields.expiration) {
      form.setValue("expiration", "");
    }
  }, [form.watch("role")]);

  return (
    <>
      <Form {...form}>
        <form
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
                    <SelectItem value="managedStudent">
                      Student account
                    </SelectItem>
                    <SelectItem value="unmanagedStudent">
                      Unmanaged student account
                    </SelectItem>
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
                    <FormLabel>
                      Email{" "}
                      {`(${
                        role_to_roleName[
                          form.watch("role") as keyof typeof role_to_roleName
                        ]
                      } ID)`}
                    </FormLabel>
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
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="First name..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Last name..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </>
          ) : null}
          {form.watch("role") &&
          form.watch("role") !== "admin" &&
          form.watch("role") !== "unmanagedStudent" ? (
            <>
              <FormField
                control={form.control}
                name="classId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Class ID</FormLabel>
                    <FormControl>
                      <Input placeholder="Class ID..." {...field} />
                    </FormControl>
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
                name="expiration"
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
          <Button type="submit" disabled={isLaoding}>{isLaoding?"Loading...":"Submit"}</Button>
        </form>
      </Form>
    </>
  );
};

const CreateAccount: FC = () => {
  return (
    <>
      <div className="m-8">
        <ManualCreate />
      </div>
    </>
  );
};

export default CreateAccount;
