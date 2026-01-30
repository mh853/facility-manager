'use client'

import { useState, useRef } from 'react'
import { X, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle } from 'lucide-react'
import * as XLSX from 'xlsx'

interface BulkUploadModalProps {
  onClose: () => void
  onSuccess: () => void
}

interface ParsedTask {
  businessName: string
  taskType: string
  currentStatus: string
  assignee: string
  memo: string
  rowNumber: number
  validationErrors: string[]
}

export default function BulkUploadModal({ onClose, onSuccess }: BulkUploadModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [parsedTasks, setParsedTasks] = useState<ParsedTask[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 엑셀 템플릿 다운로드 함수
  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new()

    // Sheet 1: 데이터 입력 시트
    const dataSheet = [
      ['사업장명', '업무타입', '현재단계', '담당자', '메모'],
      ['예시사업장', '자가', '고객 상담', '김철수', '첫 번째 업무 등록'],
      ['', '', '', '', '']
    ]
    const ws1 = XLSX.utils.aoa_to_sheet(dataSheet)

    // 컬럼 너비 설정
    ws1['!cols'] = [
      { wch: 20 }, // 사업장명
      { wch: 10 }, // 업무타입
      { wch: 15 }, // 현재단계
      { wch: 10 }, // 담당자
      { wch: 30 }  // 메모
    ]

    // Sheet 2: 입력 가이드
    const guideSheet = [
      ['📋 업무 일괄 등록 템플릿 - 입력 가이드'],
      [''],
      ['1. 사업장명'],
      ['  - 시스템에 등록된 정확한 사업장명을 입력하세요'],
      ['  - 예: "서울지점", "부산센터" 등'],
      [''],
      ['2. 업무타입'],
      ['  - 다음 중 하나를 정확히 입력하세요:'],
      ['    • 자가 (자가시설 업무)'],
      ['    • 보조금 (보조금 업무)'],
      ['    • AS (A/S 업무)'],
      [''],
      ['3. 현재단계'],
      ['  - 업무타입에 따라 유효한 단계명을 입력하세요:'],
      [''],
      ['  [자가시설 단계]'],
      ['  • 고객 상담, 현장 실사, 견적서 작성, 계약 체결, 계약금 확인'],
      ['  • 제품 발주, 제품 출고, 설치예정, 설치완료, 잔금 입금, 서류 발송 완료'],
      [''],
      ['  [보조금 단계]'],
      ['  • 신청서 작성 필요, 신청서 제출, 보조금 승인대기, 보조금 승인, 보조금 탈락'],
      ['  • 신청서 보완, 착공 전 실사, 착공 보완 1차, 착공 보완 2차, 착공신고서 제출'],
      ['  • 준공도서 작성 필요, 준공 실사, 준공 보완 1차, 준공 보완 2차, 준공 보완 3차'],
      ['  • 보조금지급신청서 제출, 보조금 입금'],
      [''],
      ['  [A/S 단계]'],
      ['  • AS 고객 상담, AS 현장 확인, AS 견적 작성'],
      ['  • AS 계약 체결, AS 부품 발주, AS 완료'],
      [''],
      ['4. 담당자'],
      ['  - 시스템에 등록된 사용자명을 입력하세요'],
      ['  - 예: "김철수", "이영희" 등'],
      [''],
      ['5. 메모 (선택사항)'],
      ['  - 업무에 대한 추가 메모를 자유롭게 입력하세요'],
      [''],
      ['⚠️ 주의사항'],
      ['  - 첫 번째 행(헤더)은 삭제하지 마세요'],
      ['  - 예시 행은 삭제하고 실제 데이터를 입력하세요'],
      ['  - 각 항목은 정확히 입력해야 합니다 (띄어쓰기, 오타 주의)'],
      ['  - 사업장명과 담당자는 시스템에 등록된 정확한 이름이어야 합니다']
    ]
    const ws2 = XLSX.utils.aoa_to_sheet(guideSheet)
    ws2['!cols'] = [{ wch: 80 }]

    XLSX.utils.book_append_sheet(wb, ws1, '데이터 입력')
    XLSX.utils.book_append_sheet(wb, ws2, '입력 가이드')

    XLSX.writeFile(wb, 'task-bulk-upload-template.xlsx')
  }

  // 파일 선택 핸들러
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setParseError(null)
      parseExcelFile(selectedFile)
    }
  }

  // 엑셀 파일 파싱
  const parseExcelFile = (file: File) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

        if (jsonData.length < 2) {
          setParseError('엑셀 파일에 데이터가 없습니다.')
          return
        }

        // 헤더 검증
        const header = jsonData[0]
        const expectedHeader = ['사업장명', '업무타입', '현재단계', '담당자', '메모']
        const isValidHeader = expectedHeader.every((col, idx) => header[idx] === col)

        if (!isValidHeader) {
          setParseError('엑셀 템플릿 형식이 올바르지 않습니다. 템플릿을 다시 다운로드하세요.')
          return
        }

        // 데이터 파싱 (헤더 제외)
        const tasks: ParsedTask[] = []
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i]

          // 빈 행 건너뛰기
          if (!row || row.every(cell => !cell)) continue

          const task: ParsedTask = {
            businessName: row[0]?.toString().trim() || '',
            taskType: row[1]?.toString().trim() || '',
            currentStatus: row[2]?.toString().trim() || '',
            assignee: row[3]?.toString().trim() || '',
            memo: row[4]?.toString().trim() || '',
            rowNumber: i + 1,
            validationErrors: []
          }

          // 기본 유효성 검사
          if (!task.businessName) {
            task.validationErrors.push('사업장명 필수')
          }
          if (!task.taskType) {
            task.validationErrors.push('업무타입 필수')
          }
          if (!task.currentStatus) {
            task.validationErrors.push('현재단계 필수')
          }
          if (!task.assignee) {
            task.validationErrors.push('담당자 필수')
          }

          // 업무타입 검증
          if (task.taskType && !['자가', '보조금', 'AS'].includes(task.taskType)) {
            task.validationErrors.push('업무타입은 "자가", "보조금", "AS" 중 하나여야 합니다')
          }

          tasks.push(task)
        }

        if (tasks.length === 0) {
          setParseError('유효한 데이터가 없습니다.')
          return
        }

        setParsedTasks(tasks)
        setParseError(null)
      } catch (error) {
        console.error('Excel parsing error:', error)
        setParseError('엑셀 파일을 읽는 중 오류가 발생했습니다.')
      }
    }

    reader.onerror = () => {
      setParseError('파일을 읽을 수 없습니다.')
    }

    reader.readAsBinaryString(file)
  }

  // 업로드 실행
  const handleUpload = async () => {
    if (parsedTasks.length === 0) return

    // 유효성 오류가 있는 항목 체크
    const hasErrors = parsedTasks.some(task => task.validationErrors.length > 0)
    if (hasErrors) {
      alert('유효성 오류가 있는 항목이 있습니다. 수정 후 다시 시도하세요.')
      return
    }

    setIsUploading(true)

    try {
      const response = await fetch('/api/admin/tasks/bulk-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tasks: parsedTasks })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '업로드 실패')
      }

      // 새로운 응답 구조에 맞춘 메시지 생성
      const successMessage = [
        `✅ 총 ${result.successCount || 0}개 업무 처리 완료`,
        result.newCount > 0 ? `   • 신규 생성: ${result.newCount}개` : null,
        result.updateCount > 0 ? `   • 업데이트: ${result.updateCount}개` : null,
        result.skipCount > 0 ? `   • 건너뛰기: ${result.skipCount}개` : null,
        result.failCount > 0 ? `\n⚠️ ${result.failCount}개 업무 실패` : null
      ].filter(Boolean).join('\n')

      alert(successMessage)
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Upload error:', error)
      alert(`업로드 중 오류가 발생했습니다: ${error.message}`)
    } finally {
      setIsUploading(false)
    }
  }

  const validTasks = parsedTasks.filter(task => task.validationErrors.length === 0)
  const invalidTasks = parsedTasks.filter(task => task.validationErrors.length > 0)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-6 h-6 text-green-600" />
            <h2 className="text-xl font-bold text-gray-900">업무 일괄 등록</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* 1단계: 템플릿 다운로드 */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">1단계: 템플릿 다운로드</h3>
            <p className="text-sm text-gray-600 mb-3">
              엑셀 템플릿을 다운로드하여 업무 정보를 입력하세요.
            </p>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>템플릿 다운로드</span>
            </button>
          </div>

          {/* 2단계: 파일 업로드 */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">2단계: 작성한 파일 업로드</h3>
            <p className="text-sm text-gray-600 mb-3">
              작성이 완료된 엑셀 파일을 업로드하세요.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span>{file ? file.name : '파일 선택'}</span>
            </button>
            {parseError && (
              <div className="mt-3 flex items-start gap-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{parseError}</span>
              </div>
            )}
          </div>

          {/* 3단계: 미리보기 */}
          {parsedTasks.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">3단계: 데이터 확인</h3>

              {/* 통계 */}
              <div className="flex gap-4 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-gray-700">유효: <strong className="text-green-600">{validTasks.length}개</strong></span>
                </div>
                {invalidTasks.length > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span className="text-gray-700">오류: <strong className="text-red-600">{invalidTasks.length}개</strong></span>
                  </div>
                )}
              </div>

              {/* 테이블 */}
              <div className="border border-gray-200 rounded-lg overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">행</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">사업장명</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">업무타입</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">현재단계</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">담당자</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">메모</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {parsedTasks.map((task, idx) => (
                      <tr key={idx} className={task.validationErrors.length > 0 ? 'bg-red-50' : ''}>
                        <td className="px-3 py-2 text-gray-900">{task.rowNumber}</td>
                        <td className="px-3 py-2 text-gray-900">{task.businessName || '-'}</td>
                        <td className="px-3 py-2 text-gray-900">{task.taskType || '-'}</td>
                        <td className="px-3 py-2 text-gray-900">{task.currentStatus || '-'}</td>
                        <td className="px-3 py-2 text-gray-900">{task.assignee || '-'}</td>
                        <td className="px-3 py-2 text-gray-500 text-xs max-w-xs truncate">{task.memo || '-'}</td>
                        <td className="px-3 py-2">
                          {task.validationErrors.length === 0 ? (
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="w-3 h-3" />
                              <span className="text-xs">정상</span>
                            </span>
                          ) : (
                            <div className="flex items-start gap-1 text-red-600">
                              <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                              <div className="text-xs">
                                {task.validationErrors.map((err, i) => (
                                  <div key={i}>{err}</div>
                                ))}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            disabled={isUploading}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleUpload}
            disabled={parsedTasks.length === 0 || invalidTasks.length > 0 || isUploading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? '업로드 중...' : `${validTasks.length}개 업무 등록`}
          </button>
        </div>
      </div>
    </div>
  )
}
