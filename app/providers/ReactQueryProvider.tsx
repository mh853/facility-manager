'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'

export default function ReactQueryProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 5분 동안 데이터를 fresh로 유지
            staleTime: 5 * 60 * 1000,
            // 10분 동안 캐시에 보관
            gcTime: 10 * 60 * 1000, // cacheTime에서 gcTime으로 변경됨 (v5)
            // 실패 시 1번만 재시도
            retry: 1,
            // 윈도우 포커스 시 자동 refetch 비활성화
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* 개발 환경에서만 DevTools 표시 */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  )
}
