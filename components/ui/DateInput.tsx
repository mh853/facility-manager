// components/ui/DateInput.tsx - 자동 포커스 이동 기능이 있는 날짜 입력 컴포넌트
'use client'

import { useState, useRef, useEffect } from 'react'

interface DateInputProps {
  value: string // YYYY-MM-DD 형식
  onChange: (value: string) => void
  className?: string
  placeholder?: string
}

export default function DateInput({ value, onChange, className = '', placeholder }: DateInputProps) {
  const [year, setYear] = useState('')
  const [month, setMonth] = useState('')
  const [day, setDay] = useState('')

  const yearRef = useRef<HTMLInputElement>(null)
  const monthRef = useRef<HTMLInputElement>(null)
  const dayRef = useRef<HTMLInputElement>(null)

  // value prop이 변경되면 내부 상태 업데이트
  useEffect(() => {
    if (value) {
      const parts = value.split('-')
      if (parts.length === 3) {
        setYear(parts[0])
        setMonth(parts[1])
        setDay(parts[2])
      }
    } else {
      setYear('')
      setMonth('')
      setDay('')
    }
  }, [value])

  // 날짜 조합하여 onChange 호출
  const updateDate = (newYear: string, newMonth: string, newDay: string) => {
    if (newYear && newMonth && newDay) {
      const formattedMonth = newMonth.padStart(2, '0')
      const formattedDay = newDay.padStart(2, '0')
      onChange(`${newYear}-${formattedMonth}-${formattedDay}`)
    } else if (!newYear && !newMonth && !newDay) {
      onChange('')
    }
  }

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 4)
    setYear(value)

    // 4자리 입력되면 월로 자동 이동 (지연 시간 추가)
    if (value.length === 4) {
      setTimeout(() => monthRef.current?.focus(), 10)
    }

    updateDate(value, month, day)
  }

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^0-9]/g, '').slice(0, 2)
    setMonth(rawValue)

    // 유효한 2자리 월이 입력되면 일로 자동 이동 (01-12만 허용)
    if (rawValue.length === 2) {
      const monthNum = parseInt(rawValue, 10)
      if (monthNum >= 1 && monthNum <= 12) {
        // 입력이 완전히 처리된 후 포커스 이동 (지연 시간 증가)
        setTimeout(() => dayRef.current?.focus(), 10)
      }
    }

    updateDate(year, rawValue, day)
  }

  const handleDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^0-9]/g, '').slice(0, 2)
    setDay(rawValue)

    // 유효한 2자리 일 검증 (01-31 허용)
    // 일 필드는 마지막 필드이므로 auto-focus는 없지만, 검증은 수행
    if (rawValue.length === 2) {
      const dayNum = parseInt(rawValue, 10)
      if (dayNum < 1 || dayNum > 31) {
        // 유효하지 않은 일자는 무시 (선택적 - 필요시 추가)
        console.warn(`Invalid day value: ${rawValue}`)
      }
    }

    updateDate(year, month, rawValue)
  }

  const handleYearKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && year.length === 0 && monthRef.current) {
      // 연도 필드가 비어있으면 이전 동작 없음
    }
  }

  const handleMonthKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && month.length === 0 && yearRef.current) {
      yearRef.current.focus()
    }
  }

  const handleDayKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && day.length === 0 && monthRef.current) {
      monthRef.current.focus()
    }
  }

  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      <input
        ref={yearRef}
        type="text"
        inputMode="numeric"
        value={year}
        onChange={handleYearChange}
        onKeyDown={handleYearKeyDown}
        placeholder="YYYY"
        className="w-16 px-2 py-1.5 border border-gray-300 rounded text-center text-[10px] sm:text-xs md:text-sm focus:ring-2 focus:ring-blue-500"
        maxLength={4}
      />
      <span className="text-gray-400">-</span>
      <input
        ref={monthRef}
        type="text"
        inputMode="numeric"
        value={month}
        onChange={handleMonthChange}
        onKeyDown={handleMonthKeyDown}
        placeholder="MM"
        className="w-12 px-2 py-1.5 border border-gray-300 rounded text-center text-[10px] sm:text-xs md:text-sm focus:ring-2 focus:ring-blue-500"
        maxLength={2}
      />
      <span className="text-gray-400">-</span>
      <input
        ref={dayRef}
        type="text"
        inputMode="numeric"
        value={day}
        onChange={handleDayChange}
        onKeyDown={handleDayKeyDown}
        placeholder="DD"
        className="w-12 px-2 py-1.5 border border-gray-300 rounded text-center text-[10px] sm:text-xs md:text-sm focus:ring-2 focus:ring-blue-500"
        maxLength={2}
      />
    </div>
  )
}
