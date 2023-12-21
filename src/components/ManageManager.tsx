import { User } from "@/models/db_schemas";
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

import { useToast } from "./ui/use-toast";

import { Input } from "@/components/ui/input";
import { X, Check } from "lucide-react";

import { ClientErrorHandler, hasIntersection, sameList } from "@/lib/utils";
import { Group, Module } from "@/models/db_schemas";
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
import Loading from "./Loading";
import { GroupType } from "@prisma/client";
import { PutUserManagesReq, batchGetGroupsByIdResSchema, getUserManagesResSchema } from "@/models/api_schemas";

interface ManageMangerProps {
  manager: User;
  reload: () => Promise<void>;
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
}

export const ManageManger: FC<ManageMangerProps> = (props) => {
  const { manager, reload, isLoading, setIsLoading } = props;
  const role = manager.role;
  const groupType: GroupType = role === "teacher" ? "class" : "family";
  const { toast } = useToast();
  const [managing, setManaging] = useState<Group[]>([]);

  useEffect(() => {
    try {
      requestAPI("user-manages", "GET", {
        email: manager.email,
      }, {}).then((data) => {
        const groups = getUserManagesResSchema.parse(data);
        setManaging(groups);
      })
    } catch (error) {
      const handler = new ClientErrorHandler(error);
      handler.log();
      toast({
        variant: "destructive",
        title: "Init Error",
        description: handler.message,
      });
    }
  }, [groupType, manager,manager.email, toast]);

  return (
    <>
      <div className="space-y-10">
        <ManageManaging
          {...{
            ...props,
            user: manager,
            managing,
            type: groupType,
          }}
        />
      </div>
    </>
  );
};

interface ManageManagingProps {
  user: User;
  reload: () => Promise<void>;
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  managing: Group[];
  type: GroupType;
}

const groupFromSchema = z.object({
  group_ids_str: trimedNonEmptyString,
});

type ManageGroupsForm = z.infer<typeof groupFromSchema>;

const ManageManaging: FC<ManageManagingProps> = (props) => {
  const { user, reload, setIsLoading, isLoading, managing, type } = props;
  const [displaying, setDisplaying] = useState<Group[]>(managing);
  const [removed, SetRemoved] = useState<Group[]>([]);
  const managing_ids: string[] = managing.map((m) => m.groupId);
  const displayingIds = displaying.map((f) => f.groupId);
  const disableSave: boolean = sameList(managing_ids, displayingIds);
  const groupToBeAdded = displaying.filter(
    (group) => !managing_ids.includes(group.groupId)
  );
  const groupToBeRemoved = removed.filter((group) =>
    managing_ids.includes(group.groupId)
  );

  const { toast } = useToast();

  const form = useForm<ManageGroupsForm>({
    resolver: zodResolver(groupFromSchema),
    defaultValues: {
      group_ids_str: "",
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
  const handleAddNew = async (values: ManageGroupsForm) => {
    const ids = values.group_ids_str
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length);
    if (!ids.length) {
      form.setError("group_ids_str", { message: "Required" });
      return;
    }
    if (hasIntersection(ids, managing_ids)) {
      const message = `Some groups are already included.`;
      form.setError("group_ids_str", { message });
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
        form.setError("group_ids_str", { message });
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
    if (!groupToBeRemoved.length && !groupToBeAdded.length) return;
    form.clearErrors();
    setIsLoading(true);
    try {
      const payload: PutUserManagesReq = {
        email: user.email,
        add: groupToBeAdded.map((g) => g.groupId),
        remove: groupToBeRemoved.map((g) => g.groupId),
      };
      const data = await requestAPI("user-manages", "PUT", {}, payload);
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
    setDisplaying([...managing]);
  }, [managing]);

  return (
    <>
      {/* {JSON.stringify(families)} */}

      <div className=" space-y-5 w-2/3">
        <p>Current {type} </p>
        <div className=" min-h-[40px] w-full rounded-md border border-input bg-transparent px-3 py-2 ">
          <ul>
            {displaying.map((group, index) => {
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
        <p>{type} to be removed</p>
        <div className=" min-h-[40px] w-full rounded-md border border-input bg-transparent px-3 py-2 ">
          <ul>
            {removed.map((group, index) => {
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
              name="group_ids_str"
              render={({ field }) => (
                <FormItem className="">
                  <FormLabel>New {type}: </FormLabel>
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
              {isLoading ? "loading..." : `Save ${type} changes`}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Are you sure to update the manages of {user.name} ?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone.{" "}
                {groupToBeRemoved.length
                  ? `This will permanently remove ${groupToBeRemoved
                      .map((g) => g.groupName)
                      .join(", ")} from the manage list of ${user.name}.`
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
