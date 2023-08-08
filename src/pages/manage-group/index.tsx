import ManageGroup from '@/components/ManageGroup'
import Navbar from '@/components/nav'

//@ts-expect-error
export default function Home(props) {
  return (
    <>
    <main>
    <Navbar active="manage_group"/>
    <div className='m-8'>
      <ManageGroup/>
    </div>
    </main>
    </>
  )
}
