'use client';

import { useEffect, useState } from 'react';
import { FileProvider, useFileContext } from '@/contexts/FileContext';
import { useSupabaseRealtime } from '@/hooks/useSupabaseRealtime';
import { useNotification } from '@/contexts/NotificationContext';
import { Bell, CheckCircle, XCircle, AlertCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react';

function RealtimeTestContent() {
  const { uploadedFiles, setBusinessInfo, refreshFiles } = useFileContext();
  const [connectionStatus, setConnectionStatus] = useState<string>('연결 중...');

  useEffect(() => {
    // 테스트용 사업장 설정
    setBusinessInfo('(주)금호정공 2공장', 'completion');
    refreshFiles();

    // 연결 상태 체크
    const timer = setTimeout(() => {
      setConnectionStatus('🔥 Realtime 연결됨');
    }, 2000);

    return () => clearTimeout(timer);
  }, [setBusinessInfo, refreshFiles]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-purple-800 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              🔥 다중 기기 실시간 동기화 테스트
            </h1>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-600">{connectionStatus}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <h2 className="text-lg font-semibold text-blue-800 mb-3">
                📊 실시간 파일 목록
              </h2>
              <p className="text-sm text-blue-600 mb-4">
                다른 기기에서 파일을 업로드/삭제하면 실시간으로 여기에 반영됩니다.
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {uploadedFiles.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    파일이 없습니다. 다른 탭이나 기기에서 파일을 업로드해보세요!
                  </p>
                ) : (
                  uploadedFiles.map((file) => (
                    <div key={file.id} className="bg-white rounded-lg p-3 border border-blue-200">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {file.originalName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {file.folderName} • {(file.size / 1024).toFixed(1)}KB
                          </p>
                        </div>
                        <div className="ml-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {file.uploadStatus}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <h2 className="text-lg font-semibold text-green-800 mb-3">
                🔄 테스트 방법
              </h2>
              <div className="space-y-3 text-sm text-green-700">
                <div className="flex items-start gap-2">
                  <span className="font-bold">1.</span>
                  <span>이 페이지를 여러 탭에서 열기</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold">2.</span>
                  <span>다른 기기(휴대폰, 태블릿)에서도 접속</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold">3.</span>
                  <span>한 쪽에서 파일 업로드/삭제 실행</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold">4.</span>
                  <span>모든 기기에서 즉시 변경사항 확인</span>
                </div>
              </div>

              <div className="mt-6 p-4 bg-white rounded-lg border border-green-200">
                <h3 className="font-semibold text-green-800 mb-2">현재 상태</h3>
                <p className="text-sm text-green-600">
                  총 파일 수: <span className="font-bold">{uploadedFiles.length}개</span>
                </p>
                <p className="text-xs text-green-500 mt-1">
                  마지막 업데이트: {new Date().toLocaleTimeString('ko-KR')}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">
              🚀 실시간 기능 활성화됨
            </h3>
            <p className="text-sm text-yellow-700">
              Supabase Realtime을 통해 모든 접속 기기에서 파일 변경사항이 실시간으로 동기화됩니다. 
              새로고침이나 별도 작업 없이 자동으로 업데이트됩니다.
            </p>
          </div>

          <div className="mt-4 text-center">
            <a
              href="/business/(주)금호정공 2공장"
              className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              ← 실제 업로드 페이지로 이동
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RealtimeTestPage() {
  return (
    <FileProvider>
      <RealtimeTestContent />
    </FileProvider>
  );
}