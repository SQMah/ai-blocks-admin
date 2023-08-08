import { Inter } from 'next/font/google'
import Navbar from '@/components/nav'
import ManageUser from '@/components/ManageUser'

//@ts-expect-error
export default function Home(props) {
  return (
    <>
    <main>
    <Navbar active="manage_user"/>
    <div className='m-8'>
    <ManageUser/>
    </div>
    </main>
    </>
  )
}
