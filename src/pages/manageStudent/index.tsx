import { Inter } from 'next/font/google'
import Navbar from '@/components/nav'
import ManageStudent from '@/components/manageStudent'

export default function Home() {
  return (
    <>
    <main>
    <Navbar active="manage_student"/>
    <div className='m-8'>
    <ManageStudent/>
    </div>
    </main>
    </>
  )
}
