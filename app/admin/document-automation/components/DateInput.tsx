'use client'

import { useRef, useState, useEffect, KeyboardEvent, ChangeEvent } from 'react'

interface DateInputProps {
  value: string // YYYY-MM-DD format
  onChange: (value: string) => void
  className?: string
  required?: boolean
  label?: string
}

export default function DateInput({ value, onChange, className = '', required = false, label }: DateInputProps) {
  const yearRef = useRef<HTMLInputElement>(null)
  const monthRef = useRef<HTMLInputElement>(null)
  const dayRef = useRef<HTMLInputElement>(null)

  // Local state for individual fields
  const [year, setYear] = useState('')
  const [month, setMonth] = useState('')
  const [day, setDay] = useState('')

  // Parse incoming value and update local state
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

  const handleYearChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4)
    setYear(val)

    // Only send complete date to parent
    if (val.length === 4 && month.length === 2 && day.length === 2) {
      onChange(`${val}-${month}-${day}`)
    } else if (val.length === 0 && month.length === 0 && day.length === 0) {
      onChange('')
    }

    // Auto-advance to month when 4 digits entered
    if (val.length === 4) {
      monthRef.current?.focus()
    }
  }

  const handleMonthChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 2)
    setMonth(val)

    // Only send complete date to parent
    if (year.length === 4 && val.length === 2 && day.length === 2) {
      onChange(`${year}-${val}-${day}`)
    } else if (year.length === 0 && val.length === 0 && day.length === 0) {
      onChange('')
    }

    // Auto-advance to day when 2 digits entered
    if (val.length === 2) {
      dayRef.current?.focus()
    }
  }

  const handleDayChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 2)
    setDay(val)

    // Only send complete date to parent
    if (year.length === 4 && month.length === 2 && val.length === 2) {
      onChange(`${year}-${month}-${val}`)
    } else if (year.length === 0 && month.length === 0 && val.length === 0) {
      onChange('')
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, field: 'year' | 'month' | 'day') => {
    // Backspace navigation
    if (e.key === 'Backspace' && e.currentTarget.value === '') {
      if (field === 'day') {
        monthRef.current?.focus()
      } else if (field === 'month') {
        yearRef.current?.focus()
      }
    }
  }

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className={`flex items-center gap-1 ${className}`}>
        <input
          ref={yearRef}
          type="text"
          inputMode="numeric"
          placeholder="YYYY"
          value={year}
          onChange={handleYearChange}
          onKeyDown={(e) => handleKeyDown(e, 'year')}
          className="w-16 px-2 py-2 border border-gray-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-blue-500"
          maxLength={4}
          required={required}
        />
        <span className="text-gray-400">-</span>
        <input
          ref={monthRef}
          type="text"
          inputMode="numeric"
          placeholder="MM"
          value={month}
          onChange={handleMonthChange}
          onKeyDown={(e) => handleKeyDown(e, 'month')}
          className="w-12 px-2 py-2 border border-gray-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-blue-500"
          maxLength={2}
          required={required}
        />
        <span className="text-gray-400">-</span>
        <input
          ref={dayRef}
          type="text"
          inputMode="numeric"
          placeholder="DD"
          value={day}
          onChange={handleDayChange}
          onKeyDown={(e) => handleKeyDown(e, 'day')}
          className="w-12 px-2 py-2 border border-gray-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-blue-500"
          maxLength={2}
          required={required}
        />
      </div>
    </div>
  )
}
