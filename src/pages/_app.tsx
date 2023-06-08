import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { Toaster } from "@/components/ui/toaster"

import Providers from '@/components/providers'

export default function App({ Component, pageProps }: AppProps) {
  return<>
  <Providers>
  <Component {...pageProps} />
  <Toaster />
  </Providers>
  </> 
}
