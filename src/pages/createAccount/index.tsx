import Navbar from '@/components/nav'
import CreateAccount from '@/components/CreateAccount'
export default function Home() {
  return (
    <>
    <main>
    <Navbar active="create_account"/>
    <CreateAccount/>
    </main>
    </>
  )
}
