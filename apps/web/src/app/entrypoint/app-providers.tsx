import { useState, type ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { useApplyTheme } from '@/shared/lib/theme'
import { Toaster } from '@/shared/ui/sonner'
import { createQueryClient } from './query-client'

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient)
  useApplyTheme()
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster richColors position="top-center" closeButton />
    </QueryClientProvider>
  )
}
