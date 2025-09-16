// app/admin/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Edit, Save, X, ExternalLink } from 'lucide-react';

interface BusinessData {
  rowIndex: number;
  번호: string;
  사업장명: string;
  상태: string;
  URL: string;
  특이사항: string;
  설치담당자: string;
  연락처: string;
  설치일: string;
}

export default function AdminPage() {
  const [businesses, setBusinesses] = useState<BusinessData[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editData, setEditData] = useState<BusinessData | null>(null);
  const [lastSync, setLastSync] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/sync', { method: 'PUT' });
      const result = await response.json();
      
      if (result.success) {
        setBusinesses(result.data);
        setLastSync(new Date().toLocaleString());
      } else {
        alert('데이터 로드 실패: ' + result.message);
      }
    } catch (error) {
      alert('데이터 로드 오류: ' + error);
    }
    setLoading(false);
  };

  // 연락처 포맷팅 함수
  const formatPhoneNumber = (phone: string): string => {
    if (!phone) return '';
    const numbers = phone.replace(/[^0-9]/g, '');
    if (numbers.length === 11 && numbers.startsWith('010')) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
    }
    return phone;
  };

  const handleEdit = (business: BusinessData) => {
    setEditingRow(business.rowIndex);
    setEditData({ ...business });
  };

  // 연락처 입력 핸들러 (자동 포맷팅)
  const handleContactChange = (value: string) => {
    if (editData) {
      setEditData({
        ...editData,
        연락처: formatPhoneNumber(value)
      });
    }
  };

  const handleSave = async () => {
    if (!editData) return;
    
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: editData.사업장명,
          updateData: {
            상태: editData.상태,
            URL: editData.URL,
            특이사항: editData.특이사항,
            설치담당자: editData.설치담당자,
            연락처: editData.연락처,
            설치일: editData.설치일
          }
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setBusinesses(prev => 
          prev.map(b => 
            b.rowIndex === editData.rowIndex ? editData : b
          )
        );
        setEditingRow(null);
        setEditData(null);
        alert('저장되었습니다.');
      } else {
        alert('저장 실패: ' + result.message);
      }
    } catch (error) {
      alert('저장 오류: ' + error);
    }
  };

  const handleCancel = () => {
    setEditingRow(null);
    setEditData(null);
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">구글시트 관리자 페이지</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">
                마지막 동기화: {lastSync}
              </span>
              <button
                onClick={loadData}
                disabled={loading}
                className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                새로고침
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 px-4 py-2 text-left">번호</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">사업장명</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">상태</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">URL</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">특이사항</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">설치담당자</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">연락처</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">설치일</th>
                  <th className="border border-gray-300 px-4 py-2 text-center">작업</th>
                </tr>
              </thead>
              <tbody>
                {businesses.map((business) => (
                  <tr key={business.rowIndex} className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-4 py-2">{business.번호}</td>
                    <td className="border border-gray-300 px-4 py-2 font-medium">
                      {business.사업장명}
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      {editingRow === business.rowIndex ? (
                        <select
                          value={editData?.상태 || ''}
                          onChange={(e) => setEditData(prev => prev ? {...prev, 상태: e.target.value} : null)}
                          className="w-full px-2 py-1 border rounded"
                        >
                          <option value="">선택</option>
                          <option value="대기중">대기중</option>
                          <option value="진행중">진행중</option>
                          <option value="완료">완료</option>
                          <option value="보류">보류</option>
                        </select>
                      ) : (
                        <span className={`px-2 py-1 rounded text-sm ${
                          business.상태 === '완료' ? 'bg-green-100 text-green-800' :
                          business.상태 === '진행중' ? 'bg-blue-100 text-blue-800' :
                          business.상태 === '보류' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {business.상태 || '대기중'}
                        </span>
                      )}
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      {business.URL ? (
                        <a
                          href={business.URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                        >
                          <ExternalLink className="w-3 h-3" />
                          보기
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      {editingRow === business.rowIndex ? (
                        <textarea
                          value={editData?.특이사항 || ''}
                          onChange={(e) => setEditData(prev => prev ? {...prev, 특이사항: e.target.value} : null)}
                          className="w-full px-2 py-1 border rounded text-sm"
                          rows={2}
                        />
                      ) : (
                        <span className="text-sm">{business.특이사항}</span>
                      )}
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      {editingRow === business.rowIndex ? (
                        <input
                          type="text"
                          value={editData?.설치담당자 || ''}
                          onChange={(e) => setEditData(prev => prev ? {...prev, 설치담당자: e.target.value} : null)}
                          className="w-full px-2 py-1 border rounded"
                        />
                      ) : (
                        business.설치담당자
                      )}
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      {editingRow === business.rowIndex ? (
                        <input
                          type="text"
                          value={editData?.연락처 || ''}
                          onChange={(e) => handleContactChange(e.target.value)}
                          placeholder="010-0000-0000"
                          maxLength={13}
                          className="w-full px-2 py-1 border rounded"
                        />
                      ) : (
                        business.연락처
                      )}
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      {editingRow === business.rowIndex ? (
                        <input
                          type="date"
                          value={editData?.설치일 || ''}
                          onChange={(e) => setEditData(prev => prev ? {...prev, 설치일: e.target.value} : null)}
                          className="w-full px-2 py-1 border rounded"
                        />
                      ) : (
                        business.설치일
                      )}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-center">
                      {editingRow === business.rowIndex ? (
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={handleSave}
                            className="flex items-center gap-1 bg-green-500 text-white px-2 py-1 rounded text-sm hover:bg-green-600"
                          >
                            <Save className="w-3 h-3" />
                            저장
                          </button>
                          <button
                            onClick={handleCancel}
                            className="flex items-center gap-1 bg-gray-500 text-white px-2 py-1 rounded text-sm hover:bg-gray-600"
                          >
                            <X className="w-3 h-3" />
                            취소
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEdit(business)}
                          className="flex items-center gap-1 bg-blue-500 text-white px-2 py-1 rounded text-sm hover:bg-blue-600"
                        >
                          <Edit className="w-3 h-3" />
                          수정
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {businesses.length === 0 && !loading && (
            <div className="text-center py-8 text-gray-500">
              데이터가 없습니다. 새로고침 버튼을 클릭하여 데이터를 불러오세요.
            </div>
          )}

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-bold text-blue-800 mb-2">사용법</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• <strong>새로고침</strong>: 구글시트에서 최신 데이터를 가져옵니다.</li>
              <li>• <strong>수정</strong>: 행을 클릭하여 데이터를 수정할 수 있습니다.</li>
              <li>• <strong>저장</strong>: 수정한 내용을 구글시트에 반영합니다.</li>
              <li>• <strong>URL</strong>: 해당 사업장의 시스템 페이지로 이동할 수 있습니다.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
