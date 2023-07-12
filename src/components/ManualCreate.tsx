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
import axios, { AxiosError } from "axios";
import {z} from "zod"

import {  roleMapping} from "@/models/auth0_schemas";
import {GetClassesResSchema, PostUsersResSchema,SetExpriationSchema,
  PostUsersReqType,BatchGetClassesResSchema } from "@/models/api_schemas";
import { UserRoleSchema } from "@/models/auth0_schemas";
import {  ClientErrorHandler} from "@/lib/utils";

interface ManualCreateProps{
  isLoading:boolean,
  setIsLoading:Dispatch<SetStateAction<boolean>>
}

const UserCreateFormSchema = z.object({
  role: UserRoleSchema ,
  email: z.string().trim().email({message:"Please provide a valid email"}),
  first_name: z.string().trim().nonempty({message:"Required"}),
  last_name: z.string().trim().nonempty({message:"Required"}),
  enrolled_class_id: z.string().trim().optional(),
  teaching_class_ids_str:z.string().trim().optional(),  
  available_modules:z.array(z.string().trim().nonempty()).optional(),
  account_expiration_date: SetExpriationSchema.or(z.literal("")).optional(),
})
.refine((input)=>{
  if(input.role==="managedStudent"){
    return input.enrolled_class_id?.length
  }else return true
},{path:["enrolled_class_id"],message:"Enrolled class ID is required for student account"}
)
.refine(input=>{
  if(input.role!=="admin"){
    return input.account_expiration_date?.length
  }else return true
},{path:["account_expiration_date"],message:`Expiration date is required`})

type UserCreateFormType = z.infer<typeof UserCreateFormSchema>

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
          //class id valiadation will also be done in api
          const {data} = await axios.get('/api/v1/classes?'+teaching.map(id=>`class_id=${id}`).join('&'))
          const present = BatchGetClassesResSchema.parse(data).map(entry=>entry.class_id)
          const missing = teaching.filter(id=>!present.includes(id))
          if(missing.length){
            const message = `${missing.join(", ")} are not valid class IDs.`
            form.setError("teaching_class_ids_str",{message})
            setIsLoading(false)
            return
          }
        } catch (error:any) {
          const handler = new ClientErrorHandler(error)
          handler.log()
          toast({
            title:"Search error",
            description:handler.message
          })
          setIsLoading(false)
          return
        }
      }
      const enrolled  = enrolled_class_id?.trim()
      if(enrolled&&role==="managedStudent"){
        try {
          //class id will also be done on api
          const {data:classData}=await axios.get('/api/v1/classes/'+enrolled)
          const target = GetClassesResSchema.parse(classData)
          //capacity check will also be done on api
          if(target.student_ids.length>=target.capacity){
            form.setError("enrolled_class_id",{message:"Class is full."})
            setIsLoading(false)
            return
          }
        } catch (error:any) {
          if(error instanceof AxiosError&&error.response?.status===404){
            form.setError("enrolled_class_id",{message:`${enrolled} is not a valid class ID`})
          }
          else{
            const handler = new ClientErrorHandler(error)
            handler.log()
            toast({
              variant:'destructive',
              title:"Search Class Error",
              description:handler.message,
            })
          }
          setIsLoading(false)
          return
        }
      }
      const userData:PostUsersReqType = {
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
      //class update will be handled by api
      const response = await axios.post("/api/v1/users", userData);
      const data = PostUsersResSchema.parse(response.data)
      form.reset()
      toast({
        title: "Created",
      })
      // console.log(data.messages);
    } catch (error: any) {
      const handler = new ClientErrorHandler(error)
      handler.log()
      toast({
        variant:"destructive",
        title: "Creation error",
        description: handler.message
      })
    }
    setIsLoading(false)
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
          <Button>test</Button>
          <div className="flex justify-end">
          {form.watch("role")?<Button type="submit" disabled={isLoading}>{isLoading?"Loading...":"Submit"}</Button>:null}
          </div>
        </form>
      </Form>
    </>
  );
};

export default ManualCreate;
