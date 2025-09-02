'use client';

import { useState } from 'react';
import { FileText, Edit3, Save, X, AlertTriangle } from 'lucide-react';

interface SpecialNotesSectionProps {
  notes: string;
  onUpdate: (notes: string) => void;
}

export default function SpecialNotesSection({ notes, onUpdate }: SpecialNotesSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editNotes, setEditNotes] = useState(notes);

  const handleSave = () => {
    onUpdate(editNotes);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditNotes(notes);
    setIsEditing(false);
  };

  return (
    <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-6 shadow-sm border border-amber-100">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <FileText className="w-6 h-6 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">특이사항</h2>
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
              className="flex items-center gap-2 px-3 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm"
            >
              <Edit3 className="w-4 h-4" />
              편집
            </button>
          )}
        </div>
      </div>
      
      <div className="space-y-4">
        {!notes && !isEditing && (
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <AlertTriangle className="w-5 h-5 text-gray-400" />
            <p className="text-gray-500">특이사항이 없습니다. 편집 버튼을 눌러 내용을 추가하세요.</p>
          </div>
        )}
        
        {isEditing ? (
          <textarea
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
            placeholder="특이사항을 입력하세요. 예: 시설 위치 변경, 추가 점검 필요 사항, 안전 주의사항 등"
          />
        ) : notes ? (
          <div className="p-4 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{notes}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}