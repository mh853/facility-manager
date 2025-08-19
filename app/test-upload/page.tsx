'use client';

import { useState } from 'react';

export default function TestUploadPage() {
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
    console.log(message);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    setFiles(selectedFiles);
    if (selectedFiles) {
      addLog(`파일 선택됨: ${selectedFiles.length}개`);
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        addLog(`  - ${file.name}: ${(file.size / 1024 / 1024).toFixed(2)}MB, ${file.type}`);
      }
    }
  };

  const testUpload = async () => {
    if (!files || files.length === 0) {
      addLog('❌ 파일을 선택해주세요');
      return;
    }

    setUploading(true);
    setResult(null);
    addLog('🚀 업로드 테스트 시작');

    try {
      const formData = new FormData();
      formData.append('businessName', '테스트사업장');
      formData.append('fileType', 'basic');
      formData.append('type', 'presurvey');

      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
        addLog(`📄 파일 추가: ${files[i].name}`);
      }

      addLog('📡 API 요청 전송 중...');
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      addLog(`📡 응답 수신: ${response.status} ${response.statusText}`);
      
      const data = await response.json();
      setResult(data);
      
      if (response.ok && data.success) {
        addLog('✅ 업로드 성공!');
        addLog(`📊 통계: ${data.stats.success}/${data.stats.total} 성공`);
      } else {
        addLog('❌ 업로드 실패');
        addLog(`오류: ${data.message}`);
        if (data.error) {
          addLog(`상세: ${data.error.details}`);
        }
      }
      
    } catch (error) {
      addLog('💥 네트워크 오류');
      addLog(`오류: ${error instanceof Error ? error.message : String(error)}`);
      setResult({ success: false, error: String(error) });
    } finally {
      setUploading(false);
    }
  };

  const testHealth = async () => {
    addLog('🔍 헬스체크 테스트 시작');
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      
      addLog(`🔍 헬스체크 응답: ${response.status}`);
      addLog(`상태: ${data.status}`);
      
      if (data.checks) {
        Object.entries(data.checks).forEach(([key, value]: [string, any]) => {
          if (typeof value === 'object' && value.status) {
            addLog(`  ${key}: ${value.status}`);
          }
        });
      }
      
      setResult(data);
    } catch (error) {
      addLog('❌ 헬스체크 실패');
      addLog(`오류: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const clearLogs = () => {
    setLogs([]);
    setResult(null);
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">📤 파일 업로드 테스트</h1>
      
      <div className="grid md:grid-cols-2 gap-6">
        {/* 업로드 테스트 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">파일 업로드 테스트</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                테스트 파일 선택 (이미지만)
              </label>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                className="w-full p-2 border rounded"
                disabled={uploading}
              />
            </div>
            
            {files && files.length > 0 && (
              <div className="text-sm text-gray-600">
                선택된 파일: {files.length}개
                <br />
                총 크기: {(Array.from(files).reduce((sum, file) => sum + file.size, 0) / 1024 / 1024).toFixed(2)}MB
              </div>
            )}
            
            <div className="flex gap-2">
              <button
                onClick={testUpload}
                disabled={uploading || !files}
                className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-300"
              >
                {uploading ? '업로드 중...' : '업로드 테스트'}
              </button>
              
              <button
                onClick={testHealth}
                className="bg-green-500 text-white px-4 py-2 rounded"
              >
                헬스체크
              </button>
              
              <button
                onClick={clearLogs}
                className="bg-gray-500 text-white px-4 py-2 rounded"
              >
                로그 지우기
              </button>
            </div>
          </div>
        </div>
        
        {/* 로그 */}
        <div className="bg-gray-50 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">실시간 로그</h2>
          
          <div className="bg-black text-green-400 p-4 rounded font-mono text-sm h-64 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="text-gray-500">로그가 여기에 표시됩니다...</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      
      {/* 결과 표시 */}
      {result && (
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">
            {result.success ? '✅ 성공 결과' : '❌ 실패 결과'}
          </h2>
          
          <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
      
      {/* 사용법 안내 */}
      <div className="mt-6 bg-blue-50 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">📋 사용법</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li><strong>헬스체크</strong>: 먼저 헬스체크를 실행해서 환경변수와 Google API 연결 상태를 확인하세요.</li>
          <li><strong>파일 선택</strong>: 테스트할 이미지 파일들을 선택하세요 (최대 10MB/파일, 50MB 총합).</li>
          <li><strong>업로드 테스트</strong>: 업로드 버튼을 클릭해서 실제 업로드를 테스트하세요.</li>
          <li><strong>로그 확인</strong>: 실시간 로그를 통해 어느 단계에서 문제가 발생하는지 확인하세요.</li>
          <li><strong>결과 분석</strong>: 성공/실패 결과를 JSON으로 확인하세요.</li>
        </ol>
      </div>
    </div>
  );
}