import { FC } from "react";
import { Button } from "./ui/button";
import { useUser } from "@auth0/nextjs-auth0/client";
import Link from "next/link";

interface props {
  active?:
    | "craete_class"
    | "manage_class"
    | "manage_student"
    | "create_account";
}

const Navbar: FC<props> = ({ active }) => {
  const { user } = useUser();

  return (
    <>
      <div className="w-full flex justify-around my-2 items-center">
        <Button variant={active === "craete_class" ? undefined : "outline"}>
          Create class
        </Button>
        <Button variant={active === "manage_class" ? undefined : "outline"}>
          Manage class
        </Button>
        <Button variant={active === "manage_student" ? undefined : "outline"}>
          <Link href="/manageStudent">Manage student</Link>
        </Button>
        <Button variant={active === "create_account" ? undefined : "outline"}>
        <Link href="/createAccount">Create Account</Link>
        </Button>
        {user ? (
          <>
            <div className=" truncate">{user.name}</div>
            <Button variant={"link"}>
              <Link href="/api/auth/logout">Logout</Link>
            </Button>
          </>
        ) : (
          <Button variant={"link"}>
            <Link href="/api/auth/login">Login</Link>
          </Button>
        )}
      </div>
    </>
  );
};

export default Navbar;
