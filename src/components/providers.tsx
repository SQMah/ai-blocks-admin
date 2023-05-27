import { UserProvider } from '@auth0/nextjs-auth0/client';
import type { FC, ReactNode } from 'react'

interface ProvidersProps {
  children: ReactNode
}

const Providers: FC<ProvidersProps> = ({ children }) => {
  return (
    <UserProvider>
      {children}
    </UserProvider>
   
  )
}

export default Providers