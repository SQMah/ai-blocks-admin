import ManageModule from '@/components/ManageModule'
import Navbar from '@/components/nav'

//@ts-expect-error
export default function Home(props) {
  return (
    <>
    <main>
    <Navbar active="manage_module"/>
    <div className='m-8'>
      <ManageModule/>
    </div>
    </main>
    </>
  )
}
