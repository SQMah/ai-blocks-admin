import { FC } from "react";
import { Button } from "./ui/button";
import { useUser } from "@auth0/nextjs-auth0/client";
import Link from "next/link";

interface props {
  active?:
    | "create_group"
    | "manage_group"
    | "manage_user"
    | "create_account"
    | "manage_module";
}

const Navbar: FC<props> = ({ active }) => {
  const { user } = useUser();

  return (
    <>
      <div className="w-full flex justify-around my-2 items-center">
        <Button variant={active === "create_group" ? undefined : "outline"}>
          <Link href="/create-group"> Create group</Link>
        </Button>
        <Button variant={active === "manage_group" ? undefined : "outline"}>
          <Link href="/manage-group"> Manage group</Link>
        </Button>
        <Button variant={active === "manage_user" ? undefined : "outline"}>
          <Link href="/manage-user">Manage user</Link>
        </Button>
        <Button variant={active === "create_account" ? undefined : "outline"}>
          <Link href="/create-account">Create account</Link>
        </Button>
        <Button variant={active === "manage_module" ? undefined : "outline"}>
          <Link href="/manage-module">Manage Module</Link>
        </Button>
        {user ? (
          <>
            <div className=" truncate">{user.email}</div>
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
