import { FC, Dispatch, SetStateAction } from "react";
import { X } from "lucide-react";

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
import { ClientErrorHandler } from "@/lib/utils";
import { User, Group } from "@/models/db_schemas";
import { requestAPI } from "@/lib/request";
import { getGroupsResSechema } from "@/models/api_schemas";

interface props {
  student: User;
  group_id: string;
  group_name: string;
  reload?: () => Promise<void>;
  handleChangeGroup?: (data: Group | undefined) => Promise<void>;
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  display?: string;
}

const RemoveStudentFromFamily: FC<props> = ({
  student,
  reload,
  isLoading,
  setIsLoading,
  group_id,
  group_name,
  display,
  handleChangeGroup,
}) => {
  const { toast } = useToast();

  const handleRemove = async () => {
    if (!student.families.includes(group_id)) return;
    setIsLoading(true);
    try {
      // console.log(paylaod)
      //update user data and class data by single api call
      const response = await requestAPI(
        "families",
        "DELETE",
        { email: student.email, group_ids: [group_id] },
        {}
      );
      if (reload) {
        await reload();
      } else if (handleChangeGroup) {
        const res = await requestAPI("groups","GET",{},{},group_id)
        const data = getGroupsResSechema.parse(res)
        await handleChangeGroup(data);
      }
    } catch (error: any) {
      const handler = new ClientErrorHandler(error);
      handler.log();
      toast({
        variant: "destructive",
        title: "Remove error",
        description: handler.message,
      });
    }
    setIsLoading(false);
  };

  return (
    <>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant={"ghost"}>
            {display ? (
              <a className=" text-red-500">{display}</a>
            ) : (
              <X color="red" />
            )}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Are you absolutely sure to remove {student.name} from {group_name}{" "}
              ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently remove{" "}
              {student.name} from {group_name}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isLoading} onClick={handleRemove}>
              {isLoading ? "Loading..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default RemoveStudentFromFamily;
