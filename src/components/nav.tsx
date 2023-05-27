import { FC } from "react";
import { Button } from "./ui/button";
import { useUser } from "@auth0/nextjs-auth0/client";
import Link from "next/link";

interface props {
  active?: string;
}

const Navbar: FC<props> = ({ active }) => {
    const {user} = useUser()

  return (
    <>
      <div className="w-full flex justify-around my-2 items-center">
        <Button variant={"outline"}>Create class</Button>
        <Button variant={"outline"}>Manage class</Button>
        <Button variant={"outline"}>Manage student</Button>
        <Button variant={"outline"}>Create account</Button>
        {
            user?<>
                <div className=" truncate">{user.name}</div>
                <Button variant={'link'}><Link href="/api/auth/logout">Logout</Link></Button>
            </>
            :<Button variant={'link'}><Link href="/api/auth/login">Login</Link></Button>
        }
      </div>
    </>
  );
};

export default Navbar;
