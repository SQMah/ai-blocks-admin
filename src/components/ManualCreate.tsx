import { FC, Dispatch,SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast"
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
import axios from "axios";

import {  roleMapping} from "@/models/auth0_schemas";
import {GetClassResSchema, PostUsersResSchema, UserCreateFormSchema,UserCreateFormType
  ,UserCreateDataType, PostUsersReqType, PutClassesReqType,BatchGetClassResSchema } from "@/models/api_schemas";
import { delay, errorMessage } from "@/lib/utils";

interface ManualCreateProps{
  isLoading:boolean,
  setIsLoading:Dispatch<SetStateAction<boolean>>
}

const ManualCreate: FC<ManualCreateProps> = ({isLoading,setIsLoading}) => {
  const { toast } = useToast()


  const form = useForm<UserCreateFormType>({
    resolver: zodResolver(UserCreateFormSchema),
    defaultValues: {
      email: "",
      first_name: "",
      last_name: "",
      enrolled_class_id:"",
      teaching_class_ids_str:"",
      account_expiration_date:"",
    },
  });

  const onSubmitManual = async (values: UserCreateFormType) => {
    setIsLoading(true)
    try {
      const {role,email,first_name,last_name,enrolled_class_id,teaching_class_ids_str,available_modules,account_expiration_date} = values
      const teaching = teaching_class_ids_str?.split(",").map(id=>id.trim()).filter(id=>id.length)??[]
      if(role==="teacher"&&teaching.length){
        try {
          const {data} = await axios.get('/api/classes?'+teaching.map(id=>`class_id=${id}`).join('&'))
          const present = BatchGetClassResSchema.parse(data).map(entry=>entry.class_id)
          const missing = teaching.filter(id=>!present.includes(id))
          if(missing.length){
            const message = `${missing.join(", ")} are not valid class IDs.`
            form.setError("teaching_class_ids_str",{message})
            setIsLoading(false)
            return
          }
        } catch (error:any) {
          const message = errorMessage(error)
          toast({
            title:"Search error",
            description:message
          })
          setIsLoading(false)
          return
        }
      }
      const enrolled  = enrolled_class_id?.trim()
      if(enrolled&&role==="managedStudent"){
        try {
          const {data:classData}=await axios.get('/api/classes/'+enrolled)
          if(!classData){
            form.setError("enrolled_class_id",{message:`${enrolled} is not a valid class ID`})
            setIsLoading(false)
            return
          }
          const target = GetClassResSchema.parse(classData)
          if(target.studentIds.length>=target.capacity){
            form.setError("enrolled_class_id",{message:"Class is full."})
            setIsLoading(false)
            return
          }
        } catch (error:any) {
          errorMessage(error)
        }
      }
      for(const id of role==="teacher"?teaching:[]){
        const body:PutClassesReqType={
          class_id:id,
          addTeachers:[email]
        }
        await axios.put('/api/classes',body)
        await delay(200)
      }
      if(enrolled&&role==="managedStudent"){
        const body:PutClassesReqType={
          class_id:enrolled,
          addStudents:[email]
        }
        await axios.put('/api/classes',body)
      }
      const userData: UserCreateDataType = {
        role,
        email,
        first_name,
        last_name,
        ...(role === "managedStudent" && { enrolled_class_id:enrolled }),
        ...(role==="unmanagedStudent"&&{available_modules}),
        ...(role==="teacher"&&{teaching_class_ids:teaching}),
        ...(role !== "admin" && { account_expiration_date }),
      };      
      // console.log(userData)
      const payload:PostUsersReqType=  { user: userData };
      const response = await axios.post("/api/users", payload);
      const data = PostUsersResSchema.parse(response.data)
      form.reset()
      toast({
        title: "Creation status",
        description: data.message,
      })
      // console.log(data.messages);
    } catch (error: any) {
      const message = errorMessage(error)
      toast({
        variant:"destructive",
        title: "Creation error",
        description: message
      })
    }
    setIsLoading(false)
  };

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
                      {`(${roleMapping[form.watch("role")]?.name} ID)`}
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
          form.watch("role") === "managedStudent" ? (
            <>
              <FormField
                control={form.control}
                name="enrolled_class_id"
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
          {form.watch("role") &&
          form.watch("role") === "teacher" ? (
            <>
              <FormField
                control={form.control}
                name="teaching_class_ids_str"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teaching classes</FormLabel>
                    <FormControl>
                      <Input placeholder="Class IDs..." {...field} />
                    </FormControl>
                    <FormDescription>{`Seperate class IDs by "," .`}</FormDescription>
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
                name="account_expiration_date"
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
          {form.watch("role")?<Button type="submit" disabled={isLoading}>{isLoading?"Loading...":"Submit"}</Button>:null}
          </div>
        </form>
      </Form>
    </>
  );
};

export default ManualCreate;
