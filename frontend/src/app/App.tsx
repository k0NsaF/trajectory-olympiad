
import { RouterProvider } from 'react-router-dom'

import { AuthProvider } from '@/app/providers'
import { GuestProfileSync } from '@/app/GuestProfileSync'
import { router } from '@/app/router'

function App() {
  return (
    <AuthProvider>
      <>
        <GuestProfileSync />
        <RouterProvider router={router} />
      </>
    </AuthProvider>
  )
}

export default App
