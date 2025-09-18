import { useEffect, useRef, useState, useCallback } from 'react'

export interface SSEEvent {
  type: 'connected' | 'initial' | 'task_added' | 'task_updated' | 'task_deleted'
  message?: string
  task?: any
  tasks?: any[]
}

export interface UseSSEOptions {
  url: string
  onMessage?: (event: SSEEvent) => void
  onError?: (error: Event) => void
  onOpen?: () => void
  onClose?: () => void
  autoReconnect?: boolean
  reconnectInterval?: number
  maxReconnectAttempts?: number
}

export function useSSE({
  url,
  onMessage,
  onError,
  onOpen,
  onClose,
  autoReconnect = true,
  reconnectInterval = 3000,
  maxReconnectAttempts = 5
}: UseSSEOptions) {
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting'>('disconnected')
  const [reconnectAttempts, setReconnectAttempts] = useState(0)

  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  const isManuallyClosedRef = useRef(false)

  const connect = useCallback(() => {
    if (eventSourceRef.current?.readyState === EventSource.OPEN) {
      return // 이미 연결됨
    }

    setConnectionStatus('connecting')

    try {
      const eventSource = new EventSource(url)
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        console.log('SSE connection opened')
        setConnectionStatus('connected')
        setReconnectAttempts(0)
        onOpen?.()
      }

      eventSource.onmessage = (event) => {
        try {
          const data: SSEEvent = JSON.parse(event.data)
          onMessage?.(data)
        } catch (error) {
          console.error('Failed to parse SSE message:', error)
        }
      }

      eventSource.onerror = (error) => {
        console.error('SSE error:', error)
        setConnectionStatus('error')
        onError?.(error)

        // 자동 재연결 로직
        if (autoReconnect && !isManuallyClosedRef.current && reconnectAttempts < maxReconnectAttempts) {
          console.log(`Attempting to reconnect in ${reconnectInterval}ms... (${reconnectAttempts + 1}/${maxReconnectAttempts})`)

          setConnectionStatus('reconnecting')
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1)
            connect()
          }, reconnectInterval)
        }
      }

      eventSource.onclose = () => {
        console.log('SSE connection closed')
        setConnectionStatus('disconnected')
        onClose?.()
      }

    } catch (error) {
      console.error('Failed to establish SSE connection:', error)
      setConnectionStatus('error')
    }
  }, [url, onMessage, onError, onOpen, onClose, autoReconnect, reconnectInterval, maxReconnectAttempts, reconnectAttempts])

  const disconnect = useCallback(() => {
    isManuallyClosedRef.current = true

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    setConnectionStatus('disconnected')
    setReconnectAttempts(0)
  }, [])

  const reconnect = useCallback(() => {
    disconnect()
    isManuallyClosedRef.current = false
    setReconnectAttempts(0)
    setTimeout(connect, 100)
  }, [disconnect, connect])

  // 컴포넌트 마운트 시 자동 연결
  useEffect(() => {
    isManuallyClosedRef.current = false
    connect()

    // 클린업
    return () => {
      disconnect()
    }
  }, [url])

  // 페이지 가시성 변경 시 재연결 로직
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && connectionStatus === 'disconnected' && !isManuallyClosedRef.current) {
        console.log('Page became visible, attempting to reconnect SSE...')
        reconnect()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [connectionStatus, reconnect])

  return {
    connectionStatus,
    reconnectAttempts,
    maxReconnectAttempts,
    connect,
    disconnect,
    reconnect,
    isConnected: connectionStatus === 'connected'
  }
}