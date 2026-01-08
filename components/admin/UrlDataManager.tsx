'use client';

import { useState, useEffect, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';

// ============================================================
// URL 데이터 관리 컴포넌트
// ============================================================
// CSV 템플릿 다운로드 및 파일 업로드 기능
// ============================================================

interface UrlDataManagerProps {
  onUploadComplete?: () => void;
  user: {
    id: string;
    permission_level: number;
  };
}

interface UploadResult {
  success: boolean;
  summary: {
    total_rows: number;
    valid_rows: number;
    error_rows: number;
    inserted_rows: number;
    updated_rows: number;
    skipped_rows: number;
  };
  errors: Array<{
    row: number;
    field: string;
    message: string;
    value?: string;
  }>;
  duplicate_urls?: string[];
}

export default function UrlDataManager({ onUploadComplete, user }: UrlDataManagerProps) {
  const [expanded, setExpanded] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [urlCount, setUrlCount] = useState<number>(0);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Supabase 클라이언트 초기화
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // URL 개수 로드
  useEffect(() => {
    loadUrlCount();
  }, []);

  const loadUrlCount = async () => {
    try {
      // Supabase 세션에서 access token 가져오기
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        console.error('[UrlDataManager] 세션이 없습니다');
        return;
      }

      console.log('[UrlDataManager] 세션 토큰 확인:', session.access_token ? '✅ 존재' : '❌ 없음');

      // API 호출 시 Authorization 헤더에 세션 토큰 포함
      const response = await fetch('/api/subsidy-crawler/direct?limit=1000', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      console.log('[UrlDataManager] API 응답 상태:', response.status, response.statusText);

      const data = await response.json();
      console.log('[UrlDataManager] API 응답 데이터:', data);

      if (data.success) {
        setUrlCount(data.total_urls || 0);
        console.log('[UrlDataManager] URL 개수 설정:', data.total_urls);
      } else {
        console.error('[UrlDataManager] URL 조회 실패:', data.error);
      }
    } catch (error) {
      console.error('[UrlDataManager] URL 개수 로드 실패:', error);
    }
  };

  // CSV 템플릿 다운로드
  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch('/api/subsidy-crawler/direct-urls/template');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `direct_urls_template_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('템플릿 다운로드 실패:', error);
      alert('템플릿 다운로드에 실패했습니다.');
    }
  };

  // 파일 선택
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        alert('CSV 파일만 업로드 가능합니다.');
        return;
      }
      setUploadFile(file);
      setUploadResult(null);
    }
  };

  // Drag & Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        alert('CSV 파일만 업로드 가능합니다.');
        return;
      }
      setUploadFile(file);
      setUploadResult(null);
    }
  };

  // 파일 업로드
  const handleUpload = async () => {
    if (!uploadFile) return;

    setUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);

      const response = await fetch('/api/subsidy-crawler/direct-urls/upload', {
        method: 'POST',
        credentials: 'include', // 쿠키 기반 세션 인증 사용
        body: formData,
      });

      // 🔍 디버깅: 응답 상태 확인
      console.log('[UrlDataManager] CSV 업로드 응답 상태:', response.status, response.statusText);

      const result: UploadResult = await response.json();

      // 🔍 디버깅: 응답 데이터 확인
      console.log('[UrlDataManager] CSV 업로드 응답 데이터:', result);

      // 응답 상태 코드 확인
      if (!response.ok) {
        // 401, 400, 500 등의 에러 응답도 result 객체에 포함되어 있음
        setUploadResult(result);
        setUploading(false);
        return;
      }

      setUploadResult(result);

      // 안전한 success 체크 - summary가 존재하는지 확인
      if (result.success && result.summary) {
        if (result.summary.inserted_rows > 0 || result.summary.updated_rows > 0) {
          // 업로드 성공 - URL 개수 및 통계 새로고침
          await loadUrlCount();
          if (onUploadComplete) {
            onUploadComplete();
          }
        }
      }
    } catch (error: any) {
      console.error('업로드 실패:', error);
      setUploadResult({
        success: false,
        summary: {
          total_rows: 0,
          valid_rows: 0,
          error_rows: 0,
          inserted_rows: 0,
          updated_rows: 0,
          skipped_rows: 0,
        },
        errors: [{
          row: 0,
          field: 'system',
          message: error.message || '업로드 중 오류가 발생했습니다.',
        }],
      });
    } finally {
      setUploading(false);
    }
  };

  // 초기화
  const handleReset = () => {
    setUploadFile(null);
    setUploadResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-white rounded-md md:rounded-lg shadow mb-4 sm:mb-6">
      {/* 헤더 */}
      <div
        className="p-2 sm:p-3 md:p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="text-lg sm:text-xl">📤</div>
          <div>
            <h3 className="font-medium text-sm sm:text-base">URL 데이터 관리</h3>
            <p className="text-xs sm:text-sm text-gray-500">
              현재 등록: <span className="font-medium text-blue-600">{urlCount}</span>개 URL
            </p>
          </div>
        </div>
        <div className="text-gray-400 text-sm sm:text-base">
          {expanded ? '▲' : '▼'}
        </div>
      </div>

      {/* 확장 영역 */}
      {expanded && (
        <div className="p-2 sm:p-3 md:p-4 border-t">
          {/* 가이드 */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-2 sm:p-3 mb-3 sm:mb-4">
            <div className="flex items-start gap-2">
              <span className="text-blue-600 text-sm sm:text-base">💡</span>
              <div className="text-xs sm:text-sm text-blue-800">
                <p className="font-medium mb-1">사용 방법:</p>
                <ol className="list-decimal list-inside space-y-0.5 text-[11px] sm:text-xs">
                  <li>CSV 템플릿을 다운로드하세요</li>
                  <li>Excel이나 Google Sheets에서 URL 정보를 입력하세요</li>
                  <li>CSV 형식으로 저장하세요</li>
                  <li>아래에서 파일을 업로드하세요</li>
                </ol>
              </div>
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-3 sm:mb-4">
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-3 border-2 border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 transition-colors text-xs sm:text-sm font-medium"
            >
              <span>📥</span>
              <div className="text-left">
                <div>CSV 템플릿 다운로드</div>
                <div className="text-[10px] sm:text-xs font-normal opacity-75">
                  17개 샘플 URL 포함
                </div>
              </div>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-3 border-2 border-green-600 text-green-600 rounded-md hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm font-medium"
            >
              <span>📤</span>
              <div className="text-left">
                <div>CSV 파일 선택</div>
                <div className="text-[10px] sm:text-xs font-normal opacity-75">
                  {uploadFile ? uploadFile.name : '파일 선택'}
                </div>
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Drag & Drop 영역 (모바일 제외) */}
          <div
            className="hidden sm:block border-2 border-dashed border-gray-300 rounded-md p-6 text-center mb-4 transition-colors"
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            style={{
              borderColor: dragActive ? '#3b82f6' : '',
              backgroundColor: dragActive ? '#eff6ff' : '',
            }}
          >
            <div className="text-3xl mb-2">📁</div>
            <p className="text-sm text-gray-600 mb-1">
              CSV 파일을 여기에 드래그하거나
            </p>
            <p className="text-xs text-gray-400">
              위의 "CSV 파일 선택" 버튼을 클릭하세요
            </p>
          </div>

          {/* 선택된 파일 정보 */}
          {uploadFile && !uploadResult && (
            <div className="bg-gray-50 rounded-md p-2 sm:p-3 mb-3 sm:mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm sm:text-base">📄</span>
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-gray-900">
                      {uploadFile.name}
                    </p>
                    <p className="text-[10px] sm:text-xs text-gray-500">
                      {(uploadFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  className="text-xs sm:text-sm text-red-600 hover:text-red-700"
                >
                  제거
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="flex-1 bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm font-medium"
                >
                  {uploading ? '업로드 중...' : '업로드 실행'}
                </button>
                <button
                  onClick={handleReset}
                  disabled={uploading}
                  className="px-3 sm:px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
                >
                  취소
                </button>
              </div>
            </div>
          )}

          {/* 업로드 결과 */}
          {uploadResult && (
            <div className="mb-3 sm:mb-4">
              {/* 요약 */}
              <div className={`rounded-md p-2 sm:p-3 mb-2 sm:mb-3 ${
                uploadResult.success ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
              }`}>
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-lg sm:text-xl">
                    {uploadResult.success ? '✅' : '⚠️'}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-xs sm:text-sm mb-1">
                      {uploadResult.success ? '업로드 완료' : '업로드 완료 (일부 오류)'}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 sm:gap-2 text-[10px] sm:text-xs">
                      <div>
                        총 <span className="font-medium">{uploadResult.summary.total_rows}</span>개 행
                      </div>
                      <div className="text-green-700">
                        신규 <span className="font-medium">{uploadResult.summary.inserted_rows}</span>개
                      </div>
                      <div className="text-blue-700">
                        업데이트 <span className="font-medium">{uploadResult.summary.updated_rows}</span>개
                      </div>
                      {uploadResult.summary.error_rows > 0 && (
                        <div className="text-red-700">
                          오류 <span className="font-medium">{uploadResult.summary.error_rows}</span>개
                        </div>
                      )}
                      {uploadResult.summary.skipped_rows > 0 && (
                        <div className="text-gray-700">
                          건너뜀 <span className="font-medium">{uploadResult.summary.skipped_rows}</span>개
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 오류 목록 */}
              {uploadResult.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-md p-2 sm:p-3 mb-2 sm:mb-3">
                  <p className="font-medium text-xs sm:text-sm text-red-800 mb-1 sm:mb-2">
                    오류 상세 ({uploadResult.errors.length}건):
                  </p>
                  <div className="space-y-1 max-h-32 sm:max-h-40 overflow-y-auto">
                    {uploadResult.errors.slice(0, 10).map((error, idx) => (
                      <div key={idx} className="text-[10px] sm:text-xs text-red-700">
                        <span className="font-medium">행 {error.row}</span>
                        {' - '}
                        <span className="text-gray-600">{error.field}</span>
                        {': '}
                        {error.message}
                        {error.value && (
                          <span className="text-gray-500"> (값: {error.value})</span>
                        )}
                      </div>
                    ))}
                    {uploadResult.errors.length > 10 && (
                      <div className="text-[10px] sm:text-xs text-red-600">
                        ... 외 {uploadResult.errors.length - 10}개 오류
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 중복 URL */}
              {uploadResult.duplicate_urls && uploadResult.duplicate_urls.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-2 sm:p-3 mb-2 sm:mb-3">
                  <p className="font-medium text-xs sm:text-sm text-blue-800 mb-1">
                    기존 URL 업데이트 ({uploadResult.duplicate_urls.length}개):
                  </p>
                  <div className="space-y-0.5 max-h-24 sm:max-h-32 overflow-y-auto">
                    {uploadResult.duplicate_urls.slice(0, 5).map((url, idx) => (
                      <div key={idx} className="text-[10px] sm:text-xs text-blue-700 truncate">
                        {url}
                      </div>
                    ))}
                    {uploadResult.duplicate_urls.length > 5 && (
                      <div className="text-[10px] sm:text-xs text-blue-600">
                        ... 외 {uploadResult.duplicate_urls.length - 5}개
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 닫기 버튼 */}
              <button
                onClick={handleReset}
                className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-xs sm:text-sm"
              >
                닫기
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
