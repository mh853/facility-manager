// components/ui/StatsCard.tsx - Statistics Card Component
'use client'

import { ReactNode } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface StatsCardProps {
  title: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  trend?: {
    value: number
    label?: string
    direction: 'up' | 'down' | 'neutral'
  }
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'indigo' | 'orange'
  description?: string
  onClick?: () => void
  loading?: boolean
  children?: ReactNode
}

const colorVariants = {
  blue: {
    bg: 'from-blue-500 to-blue-600',
    icon: 'bg-blue-100 text-blue-600',
    trend: {
      up: 'text-blue-600 bg-blue-50',
      down: 'text-blue-600 bg-blue-50', 
      neutral: 'text-blue-600 bg-blue-50'
    }
  },
  green: {
    bg: 'from-green-500 to-green-600',
    icon: 'bg-green-100 text-green-600',
    trend: {
      up: 'text-green-600 bg-green-50',
      down: 'text-red-600 bg-red-50',
      neutral: 'text-gray-600 bg-gray-50'
    }
  },
  yellow: {
    bg: 'from-yellow-500 to-yellow-600',
    icon: 'bg-yellow-100 text-yellow-600',
    trend: {
      up: 'text-green-600 bg-green-50',
      down: 'text-red-600 bg-red-50',
      neutral: 'text-gray-600 bg-gray-50'
    }
  },
  red: {
    bg: 'from-red-500 to-red-600',
    icon: 'bg-red-100 text-red-600',
    trend: {
      up: 'text-red-600 bg-red-50',
      down: 'text-green-600 bg-green-50',
      neutral: 'text-gray-600 bg-gray-50'
    }
  },
  purple: {
    bg: 'from-purple-500 to-purple-600',
    icon: 'bg-purple-100 text-purple-600',
    trend: {
      up: 'text-green-600 bg-green-50',
      down: 'text-red-600 bg-red-50',
      neutral: 'text-gray-600 bg-gray-50'
    }
  },
  indigo: {
    bg: 'from-indigo-500 to-indigo-600',
    icon: 'bg-indigo-100 text-indigo-600',
    trend: {
      up: 'text-green-600 bg-green-50',
      down: 'text-red-600 bg-red-50',
      neutral: 'text-gray-600 bg-gray-50'
    }
  },
  orange: {
    bg: 'from-orange-500 to-orange-600',
    icon: 'bg-orange-100 text-orange-600',
    trend: {
      up: 'text-green-600 bg-green-50',
      down: 'text-red-600 bg-red-50',
      neutral: 'text-gray-600 bg-gray-50'
    }
  }
}

export default function StatsCard({ 
  title, 
  value, 
  icon: Icon, 
  trend,
  color = 'blue',
  description,
  onClick,
  loading = false,
  children 
}: StatsCardProps) {
  const colorScheme = colorVariants[color]
  
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-4">
            <div className="h-4 bg-gray-200 rounded w-24"></div>
            <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
          </div>
          <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-20"></div>
        </div>
      </div>
    )
  }

  const formatValue = (val: string | number) => {
    if (typeof val === 'number') {
      return val.toLocaleString()
    }
    return val
  }

  const getTrendIcon = () => {
    if (!trend) return null
    
    switch (trend.direction) {
      case 'up':
        return <TrendingUp className="w-3 h-3" />
      case 'down':
        return <TrendingDown className="w-3 h-3" />
      case 'neutral':
      default:
        return <Minus className="w-3 h-3" />
    }
  }

  return (
    <div 
      className={`
        bg-white rounded-xl shadow-sm border border-gray-200 p-6 transition-all duration-200
        ${onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-1' : ''}
      `}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorScheme.icon}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>

      {/* Value */}
      <div className="mb-2">
        <div className="text-2xl font-bold text-gray-900">
          {formatValue(value)}
        </div>
        {description && (
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        )}
      </div>

      {/* Trend */}
      {trend && (
        <div className={`
          inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium
          ${colorScheme.trend[trend.direction]}
        `}>
          {getTrendIcon()}
          <span>{trend.value > 0 ? '+' : ''}{trend.value}%</span>
          {trend.label && <span className="ml-1">{trend.label}</span>}
        </div>
      )}

      {/* Additional Content */}
      {children && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  )
}

// Preset Stats Cards for common use cases
export const StatsCardPresets = {
  totalBusinesses: (count: number, onClick?: () => void) => ({
    title: '총 사업장',
    value: count,
    icon: ({ className }: { className?: string }) => (
      <svg className={className} fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm2 3a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm0 3a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z" clipRule="evenodd" />
      </svg>
    ),
    color: 'blue' as const,
    onClick
  }),

  activePermits: (count: number, trend?: number, onClick?: () => void) => ({
    title: '활성 대기필증',
    value: count,
    icon: ({ className }: { className?: string }) => (
      <svg className={className} fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
      </svg>
    ),
    color: 'green' as const,
    trend: trend ? { value: trend, direction: 'up' as const } : undefined,
    onClick
  }),

  pendingTasks: (count: number, onClick?: () => void) => ({
    title: '대기 중인 작업',
    value: count,
    icon: ({ className }: { className?: string }) => (
      <svg className={className} fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
      </svg>
    ),
    color: 'yellow' as const,
    onClick
  }),

  recentActivity: (count: number, onClick?: () => void) => ({
    title: '최근 활동',
    value: count,
    icon: ({ className }: { className?: string }) => (
      <svg className={className} fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
      </svg>
    ),
    color: 'purple' as const,
    onClick
  })
}