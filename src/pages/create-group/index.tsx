import Navbar from '@/components/nav'
import CreateGroup from '@/components/CreateGroup'
//@ts-expect-error
export default function Home(props) {
  return (
    <>
    <main>
    <Navbar active="create_group"/>
    <div className='m-8'>
      <CreateGroup/>
    </div>
    </main>
    </>
  )
}
