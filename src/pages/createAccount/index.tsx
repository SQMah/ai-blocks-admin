import { Inter } from 'next/font/google'
import Navbar from '@/components/nav'
import CreateAccount from '@/components/createAccount'

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
