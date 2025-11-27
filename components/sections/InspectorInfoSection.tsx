'use client';

import { useState, useEffect } from 'react';
import { User, Phone, Calendar, Save } from 'lucide-react';

interface InspectorInfo {
  name: string;
  contact: string;
  date: string;
}

interface InspectorInfoSectionProps {
  inspectorInfo: InspectorInfo;
  onUpdate: (info: InspectorInfo) => void;
  onSave?: (info?: InspectorInfo) => Promise<void>;
  isSaving?: boolean;
  title?: string; // Optional custom title
}

export default function InspectorInfoSection({ inspectorInfo, onUpdate, onSave, isSaving, title = '실사자 정보' }: InspectorInfoSectionProps) {
  const [editData, setEditData] = useState(inspectorInfo);

  // props의 inspectorInfo가 변경되면 로컬 상태 동기화
  useEffect(() => {
    setEditData(inspectorInfo);
  }, [inspectorInfo]);

  const handleSave = async () => {
    // 먼저 로컬 상태 업데이트
    onUpdate(editData);

    // DB 저장 호출 (편집된 값을 직접 전달)
    if (onSave) {
      await onSave(editData);
    }
  };

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-xl p-6 shadow-xl border-2 border-gray-200/80 hover:shadow-2xl hover:border-gray-300/80 transition-all duration-300">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <User className="w-6 h-6 text-purple-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">{title}</h2>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed transition-colors text-sm shadow-md hover:shadow-lg"
        >
          {isSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              저장 중...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              저장
            </>
          )}
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-purple-600" />
            <label className="text-sm font-medium text-gray-700">
              {title === 'AS 담당자 정보' ? 'AS 담당자명' :
               title === '설치자 정보' ? '설치자명' : '실사자명'}
            </label>
          </div>
          <input
            type="text"
            value={editData.name}
            onChange={(e) => setEditData({...editData, name: e.target.value})}
            className="w-full px-4 py-2.5 text-base border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
            placeholder={
              title === 'AS 담당자 정보' ? 'AS 담당자 이름을 입력하세요' :
              title === '설치자 정보' ? '설치자 이름을 입력하세요' : '실사자 이름을 입력하세요'
            }
            lang="ko"
            autoComplete="off"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-purple-600" />
            <label className="text-sm font-medium text-gray-700">연락처</label>
          </div>
          <input
            type="tel"
            value={editData.contact}
            onChange={(e) => {
              let value = e.target.value.replace(/[^0-9]/g, ''); // 숫자만 추출
              if (value.length <= 3) {
                // 010
                setEditData({...editData, contact: value});
              } else if (value.length <= 7) {
                // 010-1234
                setEditData({...editData, contact: `${value.slice(0, 3)}-${value.slice(3)}`});
              } else {
                // 010-1234-5678
                setEditData({...editData, contact: `${value.slice(0, 3)}-${value.slice(3, 7)}-${value.slice(7, 11)}`});
              }
            }}
            className="w-full px-4 py-2.5 text-base border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
            placeholder="010-0000-0000"
            maxLength={13}
          />
        </div>

        <div className="flex flex-col gap-2 date-input-container min-w-0">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-600" />
            <label className="text-sm font-medium text-gray-700">
              {title === 'AS 담당자 정보' ? 'AS 작업일자' :
               title === '설치자 정보' ? '설치일자' : '실사일자'}
            </label>
          </div>
          <input
            type="date"
            value={editData.date}
            onChange={(e) => setEditData({...editData, date: e.target.value})}
            className="w-full min-w-0 px-3 py-2.5 md:px-4 text-base border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
            style={{
              WebkitAppearance: 'none',
              flexShrink: 1
            }}
          />
        </div>
      </div>
    </div>
  );
}