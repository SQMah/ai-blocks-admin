import Navbar from '@/components/nav'
import CreateClass from '@/components/CreateClass'

export default function Home() {
  return (
    <>
    <main>
    <Navbar active="craete_class"/>
    <div className='m-8'>
      <CreateClass/>
    </div>
    </main>
    </>
  )
}
