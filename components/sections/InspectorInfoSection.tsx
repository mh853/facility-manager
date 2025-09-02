'use client';

import { useState } from 'react';
import { User, Phone, Calendar, Edit3, Save, X } from 'lucide-react';

interface InspectorInfo {
  name: string;
  contact: string;
  date: string;
}

interface InspectorInfoSectionProps {
  inspectorInfo: InspectorInfo;
  onUpdate: (info: InspectorInfo) => void;
}

export default function InspectorInfoSection({ inspectorInfo, onUpdate }: InspectorInfoSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(inspectorInfo);

  const handleSave = () => {
    onUpdate(editData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditData(inspectorInfo);
    setIsEditing(false);
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-sm border border-gray-100/50">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <User className="w-6 h-6 text-purple-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">실사자 정보</h2>
        </div>
        
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                <Save className="w-4 h-4" />
                저장
              </button>
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
              >
                <X className="w-4 h-4" />
                취소
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
            >
              <Edit3 className="w-4 h-4" />
              편집
            </button>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="flex items-center gap-3">
          <User className="w-5 h-5 text-gray-500" />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600">실사자명</p>
            {isEditing ? (
              <input
                type="text"
                value={editData.name}
                onChange={(e) => setEditData({...editData, name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="실사자 이름을 입력하세요"
              />
            ) : (
              <p className="text-lg font-semibold text-gray-800">{inspectorInfo.name || '미입력'}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Phone className="w-5 h-5 text-gray-500" />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600">연락처</p>
            {isEditing ? (
              <input
                type="tel"
                value={editData.contact}
                onChange={(e) => setEditData({...editData, contact: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="연락처를 입력하세요"
              />
            ) : (
              <p className="text-lg font-semibold text-gray-800">{inspectorInfo.contact || '미입력'}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-gray-500" />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600">실사일자</p>
            {isEditing ? (
              <input
                type="date"
                value={editData.date}
                onChange={(e) => setEditData({...editData, date: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            ) : (
              <p className="text-lg font-semibold text-gray-800">{inspectorInfo.date || '미입력'}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}