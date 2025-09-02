// app/admin/page.tsx - Enhanced Admin Dashboard
'use client'

import { useState, useEffect } from 'react'
import AdminLayout from '@/components/ui/AdminLayout'
import StatsCard, { StatsCardPresets } from '@/components/ui/StatsCard'
import DataTable, { commonActions } from '@/components/ui/DataTable'
import { ConfirmModal } from '@/components/ui/Modal'
import { 
  RefreshCw, 
  Edit, 
  Save, 
  X, 
  ExternalLink, 
  Building2,
  FileText,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Calendar
} from 'lucide-react'

interface BusinessData {
  rowIndex: number
  번호: string
  사업장명: string
  상태: string
  URL: string
  특이사항: string
  설치담당자: string
  연락처: string
  설치일: string
  id: string // Add ID for DataTable
}

const statusVariants = {
  '완료': 'bg-green-100 text-green-800 border-green-200',
  '진행중': 'bg-blue-100 text-blue-800 border-blue-200', 
  '보류': 'bg-red-100 text-red-800 border-red-200',
  '대기중': 'bg-gray-100 text-gray-800 border-gray-200'
}

export default function AdminPage() {
  const [businesses, setBusinesses] = useState<BusinessData[]>([])
  const [loading, setLoading] = useState(false)
  const [editingRow, setEditingRow] = useState<number | null>(null)
  const [editData, setEditData] = useState<BusinessData | null>(null)
  const [lastSync, setLastSync] = useState<string>('')
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    inProgress: 0,
    pending: 0
  })

  const loadData = async () => {
    setLoading(true)
    try {
      console.log('Admin 데이터 로드: Supabase 마이그레이션으로 인해 비활성화됨')
      
      // 샘플 데이터로 대체 (Supabase 마이그레이션 완료 후 실제 API로 교체 필요)
      const sampleData: BusinessData[] = [
        {
          rowIndex: 1,
          번호: '1',
          사업장명: '(주)조양(전체)',
          상태: '완료',
          URL: '/business/(주)조양(전체)',
          특이사항: '',
          설치담당자: '',
          연락처: '',
          설치일: '',
          id: 'business-1'
        }
      ]
      
      setBusinesses(sampleData)
      setLastSync(new Date().toLocaleString())
      
      // Calculate stats
      const completed = sampleData.filter((b: BusinessData) => b.상태 === '완료').length
      const inProgress = sampleData.filter((b: BusinessData) => b.상태 === '진행중').length
      const pending = sampleData.filter((b: BusinessData) => b.상태 === '대기중').length
      
      setStats({
        total: sampleData.length,
        completed,
        inProgress,
        pending
      });
    } catch (error) {
      console.error('네트워크 오류:', error)
      alert('데이터 로드 오류: ' + error)
    }
    setLoading(false)
  }

  const formatPhoneNumber = (phone: string): string => {
    if (!phone) return ''
    const numbers = phone.replace(/[^0-9]/g, '')
    if (numbers.length === 11 && numbers.startsWith('010')) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`
    }
    return phone
  }

  const handleEdit = (business: BusinessData) => {
    setEditingRow(business.rowIndex)
    setEditData({ ...business })
  }

  const handleSave = async () => {
    if (!editData) return
    
    try {
      // Admin 편집 기능 비활성화됨 (Google Sheets API 삭제)
      console.log('Admin 편집: Supabase 마이그레이션으로 인해 비활성화됨', editData)
      
      // 로컬 상태만 업데이트 (실제 저장은 비활성화)
      setBusinesses(prev => 
        prev.map(b => 
          b.rowIndex === editData.rowIndex ? { ...editData, id: b.id } : b
        )
      )
      setEditingRow(null)
      setEditData(null)
      alert('로컬 상태 업데이트 완료 (실제 저장은 비활성화됨)')
      return
      
      /* 원본 코드 (Google Sheets API 삭제로 비활성화):
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: editData.사업장명,
          systemType: 'presurvey',
          updateData: {
            상태: editData.상태,
            URL: editData.URL,
            특이사항: editData.특이사항,
            설치담당자: editData.설치담당자,
            연락처: editData.연락처,
            설치일: editData.설치일
          }
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        setBusinesses(prev => 
          prev.map(b => 
            b.rowIndex === editData.rowIndex ? { ...editData, id: b.id } : b
          )
        )
        setEditingRow(null)
        setEditData(null)
        alert('저장되었습니다.')
        loadData() // Refresh data to update stats
      } else {
        alert('저장 실패: ' + result.message)
      }
      */
    } catch (error) {
      alert('저장 오류: ' + error)
    }
  }

  const handleCancel = () => {
    setEditingRow(null)
    setEditData(null)
  }

  // Define table columns
  const columns = [
    {
      key: '번호',
      title: '번호',
      width: '80px',
      render: (item: BusinessData) => (
        <span className="font-mono text-sm">{item.번호}</span>
      )
    },
    {
      key: '사업장명',
      title: '사업장명',
      render: (item: BusinessData) => (
        <div className="font-medium text-gray-900">{item.사업장명}</div>
      )
    },
    {
      key: '상태',
      title: '상태',
      width: '120px',
      render: (item: BusinessData) => {
        if (editingRow === item.rowIndex) {
          return (
            <select
              value={editData?.상태 || ''}
              onChange={(e) => setEditData(prev => prev ? {...prev, 상태: e.target.value} : null)}
              className="w-full px-2 py-1 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">선택</option>
              <option value="대기중">대기중</option>
              <option value="진행중">진행중</option>
              <option value="완료">완료</option>
              <option value="보류">보류</option>
            </select>
          )
        }
        
        return (
          <span className={`
            inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border
            ${statusVariants[item.상태 as keyof typeof statusVariants] || statusVariants['대기중']}
          `}>
            {item.상태 || '대기중'}
          </span>
        )
      }
    },
    {
      key: 'URL',
      title: 'URL',
      width: '100px',
      align: 'center' as const,
      render: (item: BusinessData) => 
        item.URL ? (
          <a
            href={item.URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            <span className="hidden sm:inline">보기</span>
          </a>
        ) : (
          <span className="text-gray-400">-</span>
        )
    },
    {
      key: '설치담당자',
      title: '담당자',
      render: (item: BusinessData) => {
        if (editingRow === item.rowIndex) {
          return (
            <input
              type="text"
              value={editData?.설치담당자 || ''}
              onChange={(e) => setEditData(prev => prev ? {...prev, 설치담당자: e.target.value} : null)}
              className="w-full px-2 py-1 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          )
        }
        return <span className="text-sm">{item.설치담당자}</span>
      }
    },
    {
      key: '연락처',
      title: '연락처',
      render: (item: BusinessData) => {
        if (editingRow === item.rowIndex) {
          return (
            <input
              type="text"
              value={editData?.연락처 || ''}
              onChange={(e) => setEditData(prev => prev ? {...prev, 연락처: formatPhoneNumber(e.target.value)} : null)}
              placeholder="010-0000-0000"
              maxLength={13}
              className="w-full px-2 py-1 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          )
        }
        return <span className="text-sm font-mono">{item.연락처}</span>
      }
    },
    {
      key: '설치일',
      title: '설치일',
      render: (item: BusinessData) => {
        if (editingRow === item.rowIndex) {
          return (
            <input
              type="date"
              value={editData?.설치일 || ''}
              onChange={(e) => setEditData(prev => prev ? {...prev, 설치일: e.target.value} : null)}
              className="w-full px-2 py-1 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          )
        }
        return item.설치일 ? (
          <span className="text-sm">{item.설치일}</span>
        ) : (
          <span className="text-gray-400 text-sm">-</span>
        )
      }
    }
  ]

  // Define table actions
  const actions = [
    {
      ...commonActions.edit((item: BusinessData) => handleEdit(item)),
      show: (item: BusinessData) => editingRow !== item.rowIndex
    },
    {
      label: '저장',
      icon: Save,
      onClick: handleSave,
      variant: 'primary' as const,
      show: (item: BusinessData) => editingRow === item.rowIndex
    },
    {
      label: '취소',
      icon: X,
      onClick: handleCancel,
      variant: 'secondary' as const,
      show: (item: BusinessData) => editingRow === item.rowIndex
    }
  ]

  useEffect(() => {
    loadData()
  }, [])

  return (
    <AdminLayout
      title="구글시트 관리자 대시보드"
      description="실사 관리 시스템 통합 관리"
      actions={
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      }
    >
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard
          title="전체 사업장"
          value={stats.total}
          icon={Building2}
          color="blue"
          description="등록된 총 사업장 수"
        />
        
        <StatsCard
          title="완료"
          value={stats.completed}
          icon={CheckCircle}
          color="green"
          trend={{
            value: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
            direction: 'up',
            label: '완료율'
          }}
        />
        
        <StatsCard
          title="진행중"
          value={stats.inProgress}
          icon={Clock}
          color="yellow"
          description="현재 작업 중인 사업장"
        />
        
        <StatsCard
          title="대기중"
          value={stats.pending}
          icon={AlertCircle}
          color="red"
          description="대기 상태의 사업장"
        />
      </div>

      {/* Recent Activity Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            시스템 상태
          </h3>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>마지막 동기화: {lastSync || '없음'}</span>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-xl">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <div className="font-semibold text-green-900 text-lg">시스템 정상</div>
                <div className="text-sm text-green-600 mt-1">모든 서비스가 정상 작동 중</div>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <RefreshCw className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="font-semibold text-blue-900 text-lg">자동 동기화</div>
                <div className="text-sm text-blue-600 mt-1">구글시트와 실시간 동기화</div>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-6 border border-purple-100 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-xl">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <div className="font-semibold text-purple-900 text-lg">문서 관리</div>
                <div className="text-sm text-purple-600 mt-1">자동 문서 생성 지원</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        data={businesses}
        columns={columns}
        actions={actions}
        loading={loading}
        emptyMessage="등록된 사업장이 없습니다. 새로고침 버튼을 클릭하여 데이터를 불러오세요."
        pageSize={15}
      />

      {/* Usage Guide */}
      <div className="mt-8 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border border-blue-200 rounded-2xl p-8 shadow-sm">
        <h3 className="font-bold text-gray-900 text-xl mb-6 flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
          사용 가이드
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <RefreshCw className="w-4 h-4 mt-0.5 text-blue-600" />
              <div>
                <strong>새로고침:</strong> 구글시트에서 최신 데이터를 가져옵니다.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Edit className="w-4 h-4 mt-0.5 text-blue-600" />
              <div>
                <strong>수정:</strong> 행의 수정 버튼을 클릭하여 데이터를 편집할 수 있습니다.
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <Save className="w-4 h-4 mt-0.5 text-blue-600" />
              <div>
                <strong>저장:</strong> 수정한 내용을 구글시트에 자동으로 반영합니다.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <ExternalLink className="w-4 h-4 mt-0.5 text-blue-600" />
              <div>
                <strong>URL 보기:</strong> 해당 사업장의 시스템 페이지로 바로 이동합니다.
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}