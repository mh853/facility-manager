'use client';

import { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Factory, Shield } from 'lucide-react';
import { Facility } from '@/types';
import toast from 'react-hot-toast';

interface FacilityEditModalProps {
  facility: Facility;
  facilityType?: 'discharge' | 'prevention'; // 배출시설 or 방지시설
  businessName: string; // 사업장명 (UNIQUE 제약조건용)
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedFacility: Facility) => void;
}

// 면제사유 옵션
const exemptionReasons = [
  { value: 'none', label: '해당없음' },
  { value: '무동력', label: '무동력' },
  { value: '통합전원', label: '통합전원' },
  { value: '연속공정', label: '연속공정' },
  { value: '연간 30일 미만 가동', label: '연간 30일 미만 가동' },
  { value: '물리적으로 부착 불가능', label: '물리적으로 부착 불가능' }
];

export default function FacilityEditModal({
  facility,
  facilityType,
  businessName,
  isOpen,
  onClose,
  onSave
}: FacilityEditModalProps) {
  // 배출시설 필드
  const [dischargeCT, setDischargeCT] = useState<string>('0');
  const [exemptionReason, setExemptionReason] = useState<string>('none');

  // 방지시설 필드
  const [ph, setPh] = useState<string>('0');
  const [pressure, setPressure] = useState<string>('0');
  const [temperature, setTemperature] = useState<string>('0');
  const [pump, setPump] = useState<string>('0');
  const [fan, setFan] = useState<string>('0');

  // 공통 필드
  const [remarks, setRemarks] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // 모달이 열릴 때 facility 데이터로 초기화
  useEffect(() => {
    if (isOpen && facility) {
      // 배출시설 데이터 초기화
      setDischargeCT(facility.dischargeCT || '0');
      setExemptionReason(facility.exemptionReason || 'none');

      // 방지시설 데이터 초기화
      setPh(facility.ph || '0');
      setPressure(facility.pressure || '0');
      setTemperature(facility.temperature || '0');
      setPump(facility.pump || '0');
      setFan(facility.fan || '0');

      // 공통 데이터 초기화
      setRemarks(facility.remarks || '');
    }
  }, [isOpen, facility]);

  const handleSave = async () => {
    // ID 체크 - outlet과 number로 시설 식별 (ID가 없을 수 있음)
    if (!facility.outlet || !facility.number) {
      toast.error('시설 정보가 부족합니다.');
      return;
    }

    setIsSaving(true);
    try {
      let updateData: any = {
        business_name: businessName,
        outlet: facility.outlet,
        number: facility.number,
        type: facilityType || 'discharge',
        remarks: remarks.trim() || null
      };

      // 배출시설 데이터 추가
      if (facilityType === 'discharge') {
        updateData.dischargeCT = dischargeCT;
        updateData.exemptionReason = exemptionReason !== 'none' ? exemptionReason : null;
      }

      // 방지시설 데이터 추가
      if (facilityType === 'prevention') {
        updateData.ph = ph;
        updateData.pressure = pressure;
        updateData.temperature = temperature;
        updateData.pump = pump;
        updateData.fan = fan;
      }

      // facility.id가 있으면 사용
      if (facility.id) {
        updateData.id = facility.id;
      }

      // 수정자 정보 추가 (로그인 없이 사용하는 페이지이므로 관리자로 고정)
      updateData.last_updated_by = '관리자';

      const response = await fetch('/api/facility-measurement', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      const result = await response.json();

      if (result.success) {
        toast.success('시설 정보가 저장되었습니다.');

        // API에서 반환된 데이터와 기존 facility 정보 병합
        const updatedFacility: Facility = {
          ...facility,
          // API 응답에서 받은 측정기기 데이터 사용
          ...(result.facility || {}),
          // displayName은 기존 값 유지
          displayName: facility.displayName
        };

        onSave(updatedFacility);
        onClose();
      } else {
        // 에러 객체를 안전하게 문자열로 변환
        const errorMsg = typeof result.error === 'object'
          ? result.error?.message || JSON.stringify(result.error)
          : result.error || '저장에 실패했습니다.';
        toast.error(String(errorMsg));
      }
    } catch (error) {
      console.error('[FacilityEditModal] 저장 오류:', error);
      // 에러 객체를 안전하게 문자열로 변환
      const errorMsg = error instanceof Error ? error.message : '저장 중 오류가 발생했습니다.';
      toast.error(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className={`sticky top-0 text-white px-6 py-4 flex items-center justify-between rounded-t-2xl ${
          facilityType === 'discharge'
            ? 'bg-gradient-to-r from-orange-600 to-orange-700'
            : 'bg-gradient-to-r from-blue-600 to-blue-700'
        }`}>
          <div className="flex items-center gap-3">
            {facilityType === 'discharge' ? (
              <Factory className="w-6 h-6" />
            ) : (
              <Shield className="w-6 h-6" />
            )}
            <div>
              <h2 className="text-xl font-bold">{facility.displayName || facility.name}</h2>
              <p className="text-sm text-white/80 mt-1">
                {facilityType === 'discharge' ? '배출시설' : '방지시설'} 측정기기 정보
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isSaving}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-6 space-y-6">
          {/* 시설 기본 정보 */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">배출구:</span>
                <span className="ml-2 font-medium">{facility.outlet}호</span>
              </div>
              <div>
                <span className="text-gray-600">시설번호:</span>
                <span className="ml-2 font-medium">{facility.number}</span>
              </div>
              <div>
                <span className="text-gray-600">용량:</span>
                <span className="ml-2 font-medium">{facility.capacity}</span>
              </div>
              <div>
                <span className="text-gray-600">수량:</span>
                <span className="ml-2 font-medium">{facility.quantity}개</span>
              </div>
            </div>
          </div>

          {/* 배출시설 측정기기 필드 */}
          {facilityType === 'discharge' && (
            <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
              <h3 className="font-semibold text-orange-800 mb-4 flex items-center gap-2">
                <Factory className="w-5 h-5" />
                배출시설 측정기기
              </h3>

              <div className="space-y-4">
                {/* 배출CT 개수 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    배출CT 개수
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={dischargeCT}
                    onChange={(e) => setDischargeCT(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                    placeholder="배출CT 개수"
                  />
                </div>

                {/* 면제사유 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    면제사유
                  </label>
                  <select
                    value={exemptionReason}
                    onChange={(e) => setExemptionReason(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                  >
                    {exemptionReasons.map(reason => (
                      <option key={reason.value} value={reason.value}>
                        {reason.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    측정기기 설치가 면제되는 경우 사유를 선택하세요
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 방지시설 측정기기 필드 */}
          {facilityType === 'prevention' && (
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <h3 className="font-semibold text-blue-800 mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                방지시설 측정기기
              </h3>

              <div className="grid grid-cols-2 gap-4">
                {/* pH 센서 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    pH 센서
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={ph}
                    onChange={(e) => setPh(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="pH 센서 수량"
                  />
                </div>

                {/* 차압계 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    차압계
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={pressure}
                    onChange={(e) => setPressure(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="차압계 수량"
                  />
                </div>

                {/* 온도계 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    온도계
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="온도계 수량"
                  />
                </div>

                {/* 펌프CT */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    펌프CT
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={pump}
                    onChange={(e) => setPump(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="펌프CT 수량"
                  />
                </div>

                {/* 송풍CT */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    송풍CT
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={fan}
                    onChange={(e) => setFan(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="송풍CT 수량"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 비고(특이사항) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              비고(특이사항)
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
              placeholder="시설과 관련된 특이사항이나 메모를 입력하세요"
            />
            <p className="text-xs text-gray-500 mt-1">
              정기점검 필요 사항, 안전 주의사항 등을 입력하세요
            </p>
          </div>

          {/* 안내 메시지 */}
          <div className={`rounded-lg p-4 flex gap-3 ${
            facilityType === 'discharge'
              ? 'bg-orange-50 border border-orange-200'
              : 'bg-blue-50 border border-blue-200'
          }`}>
            <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
              facilityType === 'discharge' ? 'text-orange-600' : 'text-blue-600'
            }`} />
            <div className="text-sm">
              <p className="font-medium mb-1">입력 안내</p>
              <ul className={`list-disc list-inside space-y-1 ${
                facilityType === 'discharge' ? 'text-orange-700' : 'text-blue-700'
              }`}>
                <li>측정기기 수량은 0 이상의 정수를 입력하세요</li>
                {facilityType === 'discharge' && (
                  <li>면제사유는 해당되는 경우에만 선택하세요</li>
                )}
                <li>비고는 선택사항입니다</li>
                <li>저장 시 자동으로 수정 시각과 수정자가 기록됩니다</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 rounded-b-2xl border-t border-gray-200">
          <button
            onClick={handleClose}
            disabled={isSaving}
            className="px-6 py-2.5 text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`px-6 py-2.5 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2 shadow-md hover:shadow-lg ${
              facilityType === 'discharge'
                ? 'bg-orange-600 hover:bg-orange-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
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
      </div>
    </div>
  );
}
