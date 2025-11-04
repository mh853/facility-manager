// components/DeliveryAddressManager.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { TokenManager } from '@/lib/api-client'

export interface DeliveryAddress {
  id: string
  name: string
  recipient: string
  phone: string
  address: string
  postal_code?: string
  is_default: boolean
  use_count: number
  last_used_at?: string
  is_active: boolean
  notes?: string
}

interface DeliveryAddressManagerProps {
  onSelect?: (address: DeliveryAddress) => void
  selectedId?: string
}

export default function DeliveryAddressManager({
  onSelect,
  selectedId
}: DeliveryAddressManagerProps) {
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    recipient: '',
    phone: '',
    address: ''
  })

  const loadAddresses = async () => {
    try {
      setLoading(true)
      const token = TokenManager.getToken()

      if (!token) {
        console.error('인증 토큰이 없습니다')
        alert('로그인이 필요합니다')
        return
      }

      const response = await fetch('/api/delivery-addresses', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('택배주소 조회 실패')
      }

      const result = await response.json()
      setAddresses(result.data?.addresses || [])
    } catch (error) {
      console.error('택배주소 로드 오류:', error)
      alert('택배주소를 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAddresses()
  }, [])

  const formatPhoneNumber = (value: string): string => {
    // 숫자만 추출
    const numbers = value.replace(/[^\d]/g, '')

    // 길이에 따라 포맷 적용
    if (numbers.length <= 3) {
      return numbers
    } else if (numbers.length <= 7) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3)}`
    } else if (numbers.length <= 11) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`
    } else {
      // 11자리 초과시 11자리까지만 사용
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`
    }
  }

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value)
    setFormData({ ...formData, phone: formatted })
  }

  const resetForm = () => {
    setFormData({
      name: '',
      recipient: '',
      phone: '',
      address: ''
    })
    setIsAdding(false)
    setEditingId(null)
  }

  const handleAdd = async () => {
    if (!formData.name || !formData.recipient || !formData.phone || !formData.address) {
      alert('필수 항목을 모두 입력해주세요')
      return
    }

    try {
      const token = TokenManager.getToken()

      if (!token) {
        console.error('인증 토큰이 없습니다')
        alert('로그인이 필요합니다')
        return
      }

      const response = await fetch('/api/delivery-addresses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        throw new Error('택배주소 추가 실패')
      }

      alert('택배주소가 추가되었습니다')
      resetForm()
      loadAddresses()
    } catch (error) {
      console.error('택배주소 추가 오류:', error)
      alert('택배주소 추가에 실패했습니다')
    }
  }

  const handleEdit = async () => {
    if (!editingId) return

    if (!formData.name || !formData.recipient || !formData.phone || !formData.address) {
      alert('필수 항목을 모두 입력해주세요')
      return
    }

    try {
      const token = TokenManager.getToken()

      if (!token) {
        console.error('인증 토큰이 없습니다')
        alert('로그인이 필요합니다')
        return
      }

      const response = await fetch('/api/delivery-addresses', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          id: editingId,
          ...formData
        })
      })

      if (!response.ok) {
        throw new Error('택배주소 수정 실패')
      }

      alert('택배주소가 수정되었습니다')
      resetForm()
      loadAddresses()
    } catch (error) {
      console.error('택배주소 수정 오류:', error)
      alert('택배주소 수정에 실패했습니다')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 택배주소를 삭제하시겠습니까?')) {
      return
    }

    try {
      const token = TokenManager.getToken()

      if (!token) {
        console.error('인증 토큰이 없습니다')
        alert('로그인이 필요합니다')
        return
      }

      const response = await fetch(`/api/delivery-addresses?id=${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('택배주소 삭제 실패')
      }

      alert('택배주소가 삭제되었습니다')
      loadAddresses()
    } catch (error) {
      console.error('택배주소 삭제 오류:', error)
      alert('택배주소 삭제에 실패했습니다')
    }
  }

  const startEdit = (address: DeliveryAddress) => {
    setFormData({
      name: address.name,
      recipient: address.recipient,
      phone: address.phone,
      address: address.address
    })
    setEditingId(address.id)
    setIsAdding(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">불러오는 중...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {!isAdding && (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">저장된 택배주소</h3>
            <button
              onClick={() => setIsAdding(true)}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              + 새 주소 추가
            </button>
          </div>

          {addresses.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>저장된 택배주소가 없습니다</p>
              <button
                onClick={() => setIsAdding(true)}
                className="mt-3 text-blue-600 hover:underline"
              >
                첫 주소를 추가해보세요
              </button>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {addresses.map((address) => (
                <div
                  key={address.id}
                  className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                    selectedId === address.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => onSelect?.(address)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">{address.name}</span>
                        {address.is_default && (
                          <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                            기본
                          </span>
                        )}
                        {address.use_count > 0 && (
                          <span className="text-xs text-gray-500">
                            사용 {address.use_count}회
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        <p>
                          {address.recipient} / {address.phone}
                        </p>
                        <p className="mt-1">{address.address}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 ml-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          startEdit(address)
                        }}
                        className="px-2 py-1 text-xs text-gray-600 hover:text-blue-600"
                      >
                        수정
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(address.id)
                        }}
                        className="px-2 py-1 text-xs text-gray-600 hover:text-red-600"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isAdding && (
        <div className="border rounded-lg p-4 bg-gray-50">
          <h3 className="font-semibold text-gray-900 mb-3">
            {editingId ? '택배주소 수정' : '새 택배주소 추가'}
          </h3>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                주소 별칭 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="예: 본사, 경기 창고"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                담당자명 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.recipient}
                onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
                placeholder="홍길동"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                연락처 <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="010-1234-5678"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                주소 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="서울특별시 강남구 테헤란로 123"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={editingId ? handleEdit : handleAdd}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {editingId ? '수정' : '추가'}
            </button>
            <button
              onClick={resetForm}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
