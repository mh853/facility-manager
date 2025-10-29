'use client'

import React from 'react'
import { Target, TrendingUp, AlertCircle, Clock } from 'lucide-react'
import { Task } from '../types'

interface TaskStatsProps {
  tasks: Task[]
  className?: string
}

interface StatsData {
  totalTasks: number
  stepsWithTasks: number
  highPriorityTasks: number
  delayedTasks: number
  atRiskTasks: number
}

/**
 * 업무 통계 대시보드 컴포넌트
 * 전체 업무, 활성 단계, 우선순위, 지연/위험 업무 통계를 표시
 */
export default function TaskStats({ tasks, className = '' }: TaskStatsProps) {
  // 통계 계산
  const stats: StatsData = React.useMemo(() => {
    const totalTasks = tasks.length
    const highPriorityTasks = tasks.filter(task => task.priority === 'high').length
    const delayedTasks = tasks.filter(task =>
      task.delayStatus === 'delayed' || task.delayStatus === 'overdue'
    ).length
    const atRiskTasks = tasks.filter(task => task.delayStatus === 'at_risk').length

    // 활성 단계 계산 (업무가 있는 고유한 상태의 수)
    const uniqueStatuses = new Set(tasks.map(task => task.status))
    const stepsWithTasks = uniqueStatuses.size

    return {
      totalTasks,
      stepsWithTasks,
      highPriorityTasks,
      delayedTasks,
      atRiskTasks
    }
  }, [tasks])

  return (
    <div className={`grid grid-cols-3 md:grid-cols-5 gap-2 md:gap-4 ${className}`}>
      {/* 전체 업무 */}
      <StatCard
        label="전체 업무"
        value={stats.totalTasks}
        icon={<Target className="w-4 h-4 md:w-6 md:h-6 text-blue-500" />}
        valueColor="text-gray-900"
        tooltip={{
          title: "📊 전체 업무",
          items: [
            "시스템에 등록된 모든 업무",
            "삭제되지 않은 활성 상태 업무",
            "모든 단계와 우선순위 포함"
          ]
        }}
      />

      {/* 활성 단계 */}
      <StatCard
        label="활성 단계"
        value={stats.stepsWithTasks}
        icon={<TrendingUp className="w-4 h-4 md:w-6 md:h-6 text-orange-500" />}
        valueColor="text-orange-600"
        tooltip={{
          title: "🔄 활성 단계",
          items: [
            "업무가 있는 워크플로우 단계 수",
            "총 단계 중 업무가 진행 중인 단계",
            "비어있는 단계는 제외"
          ]
        }}
      />

      {/* 높은 우선순위 */}
      <StatCard
        label="높은 우선순위"
        value={stats.highPriorityTasks}
        icon={<AlertCircle className="w-4 h-4 md:w-6 md:h-6 text-red-500" />}
        valueColor="text-red-600"
        tooltip={{
          title: "🔴 높은 우선순위",
          items: [
            "우선순위가 '높음'으로 설정된 업무",
            "즉시 처리가 필요한 긴급 업무",
            "빠른 대응이 요구되는 업무"
          ]
        }}
      />

      {/* 지연 업무 */}
      <StatCard
        label="지연 업무"
        value={stats.delayedTasks}
        icon={<Clock className="w-4 h-4 md:w-6 md:h-6 text-red-500" />}
        valueColor="text-red-700"
        bgColor="bg-red-50"
        borderColor="border-red-200"
        labelColor="text-red-600"
        tooltip={{
          title: "📅 지연 업무 기준",
          items: [
            "자비 설치: 시작 후 21일",
            "보조금: 시작 후 30일",
            "AS: 시작 후 10일",
            "기타: 시작 후 15일"
          ]
        }}
      />

      {/* 위험 업무 */}
      <StatCard
        label="위험 업무"
        value={stats.atRiskTasks}
        icon={<AlertCircle className="w-4 h-4 md:w-6 md:h-6 text-yellow-500" />}
        valueColor="text-yellow-700"
        bgColor="bg-yellow-50"
        borderColor="border-yellow-200"
        labelColor="text-yellow-600"
        tooltip={{
          title: "⚠️ 위험 업무 기준",
          items: [
            "자비 설치: 시작 후 14일",
            "보조금: 시작 후 20일",
            "AS: 시작 후 7일",
            "기타: 시작 후 10일"
          ]
        }}
      />
    </div>
  )
}

// ==================== 하위 컴포넌트 ====================

interface StatCardProps {
  label: string
  value: number
  icon: React.ReactNode
  valueColor: string
  bgColor?: string
  borderColor?: string
  labelColor?: string
  tooltip?: {
    title: string
    items: string[]
  }
}

/**
 * 개별 통계 카드 컴포넌트
 */
function StatCard({
  label,
  value,
  icon,
  valueColor,
  bgColor = 'bg-white',
  borderColor = 'border-gray-200',
  labelColor = 'text-gray-600',
  tooltip
}: StatCardProps) {
  return (
    <div
      className={`${bgColor} rounded-md md:rounded-lg border ${borderColor} p-2 md:p-3 cursor-help relative group`}
      title={tooltip ? tooltip.items.join(', ') : undefined}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-xs ${labelColor}`}>{label}</p>
          <p className={`text-sm sm:text-lg md:text-2xl font-semibold ${valueColor}`}>
            {value}
          </p>
        </div>
        {icon}
      </div>

      {/* 호버 툴팁 (데스크탑만) */}
      {tooltip && (
        <div className="hidden md:block absolute left-0 top-full mt-2 w-48 md:w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
          <div className="font-semibold mb-2">{tooltip.title}</div>
          <div className="space-y-1">
            {tooltip.items.map((item, index) => (
              <div key={index}>• {item}</div>
            ))}
          </div>
          {/* 화살표 */}
          <div className="absolute bottom-full left-4 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-900"></div>
        </div>
      )}
    </div>
  )
}
