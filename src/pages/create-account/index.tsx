import Navbar from '@/components/nav'
import CreateAccount from "@/components/createAccount"

//@ts-expect-error
export default function Home(props) {
  return (
    <>
    <main>
    <Navbar active="create_account"/>
    <CreateAccount/>
    </main>
    </>
  )
}
