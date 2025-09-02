'use client';

import { useState, useEffect, useCallback } from 'react';
import { Factory, Shield, Router, Thermometer, Droplets, Zap, Gauge, AlertTriangle, Save, Edit3, Plus, Trash2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Facility, FacilitiesData } from '@/types';

interface EnhancedFacilityInfoSectionProps {
  businessName: string;
  businessId?: string;
  facilities: FacilitiesData;
  systemType: 'completion' | 'presurvey';
  onFacilitiesUpdate: (facilities: FacilitiesData) => void;
}

// 배출시설 면제사유 옵션
const exemptionReasons = [
  { value: 'none', label: '해당없음' },
  { value: '무동력', label: '무동력' },
  { value: '통합전원', label: '통합전원' },
  { value: '연속공정', label: '연속공정' },
  { value: '연간 30일 미만 가동', label: '연간 30일 미만 가동' },
  { value: '물리적으로 부착 불가능', label: '물리적으로 부착 불가능' }
];

// 방지시설 타입별 디폴트 측정기기 설정
const preventionFacilityDefaults = {
  '여과집진시설': { pressure: '1', temperature: '1', fan: '1' },
  '흡착에의한시설': { pressure: '1', temperature: '1', fan: '1' },
  '여과및흡착에의한시설': { pressure: '1', temperature: '1', fan: '1' },
  '흡수에의한시설': { ph: '1', pump: '1' },
  '원심력집진시설': { fan: '1' }
};

export default function EnhancedFacilityInfoSection({
  businessName,
  businessId,
  facilities,
  systemType,
  onFacilitiesUpdate
}: EnhancedFacilityInfoSectionProps) {
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null);
  const [facilityType, setFacilityType] = useState<'discharge' | 'prevention'>('discharge');
  const [showAddForm, setShowAddForm] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [equipmentCounts, setEquipmentCounts] = useState({
    phSensor: 0,
    differentialPressureMeter: 0,
    temperatureMeter: 0,
    dischargeCT: 0,
    fanCT: 0,
    pumpCT: 0,
    gateway: 0,
    totalDevices: 0
  });

  // 측정기기 수량 계산
  const calculateEquipmentCounts = useCallback(() => {
    let counts = {
      phSensor: 0,
      differentialPressureMeter: 0,
      temperatureMeter: 0,
      dischargeCT: 0,
      fanCT: 0,
      pumpCT: 0,
      gateway: 0,
      totalDevices: 0
    };

    // 배출시설에서 배출CT 카운트
    facilities.discharge?.forEach(facility => {
      if (facility.dischargeCT && facility.dischargeCT !== '0') {
        counts.dischargeCT += parseInt(facility.dischargeCT) || 0;
      }
    });

    // 방지시설에서 측정기기 카운트
    facilities.prevention?.forEach(facility => {
      if (facility.ph && facility.ph !== '0') {
        counts.phSensor += parseInt(facility.ph) || 0;
      }
      if (facility.pressure && facility.pressure !== '0') {
        counts.differentialPressureMeter += parseInt(facility.pressure) || 0;
      }
      if (facility.temperature && facility.temperature !== '0') {
        counts.temperatureMeter += parseInt(facility.temperature) || 0;
      }
      if (facility.fan && facility.fan !== '0') {
        counts.fanCT += parseInt(facility.fan) || 0;
      }
      if (facility.pump && facility.pump !== '0') {
        counts.pumpCT += parseInt(facility.pump) || 0;
      }
    });

    // 방지시설에서 게이트웨이 수량 계산
    facilities.prevention?.forEach(facility => {
      if (facility.gatewayInfo?.id && facility.gatewayInfo.id !== '0') {
        counts.gateway += parseInt(facility.gatewayInfo.id) || 0;
      }
    });

    counts.totalDevices = counts.phSensor + counts.differentialPressureMeter + 
                         counts.temperatureMeter + counts.dischargeCT + 
                         counts.fanCT + counts.pumpCT + counts.gateway;

    setEquipmentCounts(counts);
    return counts;
  }, [facilities]);

  useEffect(() => {
    calculateEquipmentCounts();
  }, [calculateEquipmentCounts]);

  // 방지시설 디폴트 값 적용
  const applyPreventionDefaults = (facilityName: string) => {
    const defaults = Object.entries(preventionFacilityDefaults).find(([key]) => 
      facilityName.includes(key)
    )?.[1];
    
    return defaults || {};
  };

  const handleEditFacility = (facility: Facility, type: 'discharge' | 'prevention') => {
    setEditingFacility(facility);
    setFacilityType(type);
    setShowAddForm(true);
  };

  const handleSaveFacility = async () => {
    if (!editingFacility) return;

    try {
      const updatedFacilities = { ...facilities };
      const facilityArray = facilityType === 'discharge' ? updatedFacilities.discharge : updatedFacilities.prevention;
      
      const index = facilityArray?.findIndex(f => 
        f.outlet === editingFacility.outlet && f.number === editingFacility.number
      );
      
      if (index !== -1 && facilityArray) {
        facilityArray[index] = editingFacility;
        onFacilitiesUpdate(updatedFacilities);
        
        // 수량 재계산 및 Supabase 저장
        const newCounts = calculateEquipmentCounts();
        await saveEquipmentCounts(newCounts);
      }

      setShowAddForm(false);
      setEditingFacility(null);
    } catch (error) {
      console.error('시설 정보 저장 실패:', error);
    }
  };

  // 측정기기 수량을 Supabase에 저장
  const saveEquipmentCounts = async (counts: typeof equipmentCounts) => {
    if (!businessId) return;

    try {
      const response = await fetch('/api/business-equipment-counts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          equipmentCounts: counts
        })
      });

      if (!response.ok) {
        throw new Error('측정기기 수량 저장 실패');
      }

      console.log('✅ 측정기기 수량 저장 완료:', counts);
    } catch (error) {
      console.error('❌ 측정기기 수량 저장 실패:', error);
    }
  };

  const renderFacilityCard = (facility: Facility, type: 'discharge' | 'prevention') => {
    return (
      <div key={`${facility.outlet}-${facility.number}`} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {type === 'discharge' ? (
              <Factory className="w-5 h-5 text-orange-500" />
            ) : (
              <Shield className="w-5 h-5 text-blue-500" />
            )}
            <div>
              <h3 className="font-semibold text-gray-900">{facility.displayName}</h3>
              <p className="text-sm text-gray-600">배출구 {facility.outlet}번 - {facility.name}</p>
              <p className="text-xs text-gray-500">용량: {facility.capacity}</p>
            </div>
          </div>
          
          <button
            onClick={() => handleEditFacility(facility, type)}
            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
          >
            <Edit3 className="w-4 h-4" />
          </button>
        </div>

        {/* 배출시설 정보 */}
        {type === 'discharge' && (
          <div className="space-y-2 text-sm">
            {facility.dischargeCT && (
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-orange-500" />
                <span>배출CT: {facility.dischargeCT}개</span>
              </div>
            )}
            {facility.exemptionReason && facility.exemptionReason !== 'none' && (
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                <span>면제사유: {facility.exemptionReason}</span>
              </div>
            )}
            {facility.remarks && (
              <div className="text-gray-600">
                <span className="font-medium">비고:</span> {facility.remarks}
              </div>
            )}
          </div>
        )}

        {/* 방지시설 정보 */}
        {type === 'prevention' && (
          <div className="grid grid-cols-2 gap-2 text-sm">
            {facility.ph && facility.ph !== '0' && (
              <div className="flex items-center gap-1">
                <Droplets className="w-3 h-3 text-cyan-500" />
                <span>pH계: {facility.ph}</span>
              </div>
            )}
            {facility.pressure && facility.pressure !== '0' && (
              <div className="flex items-center gap-1">
                <Gauge className="w-3 h-3 text-purple-500" />
                <span>차압계: {facility.pressure}</span>
              </div>
            )}
            {facility.temperature && facility.temperature !== '0' && (
              <div className="flex items-center gap-1">
                <Thermometer className="w-3 h-3 text-red-500" />
                <span>온도계: {facility.temperature}</span>
              </div>
            )}
            {facility.fan && facility.fan !== '0' && (
              <div className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-green-500" />
                <span>송풍CT: {facility.fan}</span>
              </div>
            )}
            {facility.pump && facility.pump !== '0' && (
              <div className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-blue-500" />
                <span>펌프CT: {facility.pump}</span>
              </div>
            )}
            {facility.remarks && (
              <div className="col-span-2 text-gray-600">
                <span className="font-medium">비고:</span> {facility.remarks}
              </div>
            )}
          </div>
        )}

        {/* 게이트웨이 정보 */}
        {facility.gatewayInfo && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2 text-sm">
              <Router className="w-4 h-4 text-blue-500" />
              <span>게이트웨이: {facility.gatewayInfo.ip || 'IP 미설정'}</span>
              <span className={`px-2 py-1 rounded-full text-xs ${
                facility.gatewayInfo.status === 'connected' ? 'bg-green-100 text-green-800' :
                facility.gatewayInfo.status === 'error' ? 'bg-red-100 text-red-800' : 
                'bg-gray-100 text-gray-800'
              }`}>
                {facility.gatewayInfo.status === 'connected' ? '연결됨' :
                 facility.gatewayInfo.status === 'error' ? '오류' : '연결안됨'}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderEditForm = () => {
    if (!editingFacility || !showAddForm) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {facilityType === 'discharge' ? '배출시설' : '방지시설'} 정보 수정
              </h2>
              <button
                onClick={() => setShowAddForm(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* 기본 정보 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    시설명
                  </label>
                  <input
                    type="text"
                    value={editingFacility.name}
                    onChange={(e) => setEditingFacility({ ...editingFacility, name: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    용량
                  </label>
                  <input
                    type="text"
                    value={editingFacility.capacity}
                    onChange={(e) => setEditingFacility({ ...editingFacility, capacity: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* 배출시설 전용 필드 */}
              {facilityType === 'discharge' && (
                <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                  <h3 className="font-semibold text-orange-800 mb-4 flex items-center gap-2">
                    <Factory className="w-5 h-5" />
                    배출시설 정보
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        배출CT 개수
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editingFacility.dischargeCT || '0'}
                        onChange={(e) => setEditingFacility({ ...editingFacility, dischargeCT: e.target.value })}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        면제사유
                      </label>
                      <select
                        value={editingFacility.exemptionReason || 'none'}
                        onChange={(e) => setEditingFacility({ ...editingFacility, exemptionReason: e.target.value as any })}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {exemptionReasons.map(reason => (
                          <option key={reason.value} value={reason.value}>
                            {reason.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      비고 (특이사항)
                    </label>
                    <textarea
                      value={editingFacility.remarks || ''}
                      onChange={(e) => setEditingFacility({ ...editingFacility, remarks: e.target.value })}
                      rows={3}
                      placeholder="특이사항이나 추가 설명을 입력하세요..."
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              {/* 방지시설 전용 필드 */}
              {facilityType === 'prevention' && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h3 className="font-semibold text-blue-800 mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    방지시설 측정기기
                  </h3>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                        <Droplets className="w-4 h-4 text-cyan-500" />
                        pH계
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editingFacility.ph || '0'}
                        onChange={(e) => setEditingFacility({ ...editingFacility, ph: e.target.value })}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                        <Gauge className="w-4 h-4 text-purple-500" />
                        차압계
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editingFacility.pressure || '0'}
                        onChange={(e) => setEditingFacility({ ...editingFacility, pressure: e.target.value })}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                        <Thermometer className="w-4 h-4 text-red-500" />
                        온도계
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editingFacility.temperature || '0'}
                        onChange={(e) => setEditingFacility({ ...editingFacility, temperature: e.target.value })}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                        <Zap className="w-4 h-4 text-green-500" />
                        송풍CT
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editingFacility.fan || '0'}
                        onChange={(e) => setEditingFacility({ ...editingFacility, fan: e.target.value })}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                        <Zap className="w-4 h-4 text-blue-500" />
                        펌프CT
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editingFacility.pump || '0'}
                        onChange={(e) => setEditingFacility({ ...editingFacility, pump: e.target.value })}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      비고 (특이사항)
                    </label>
                    <textarea
                      value={editingFacility.remarks || ''}
                      onChange={(e) => setEditingFacility({ ...editingFacility, remarks: e.target.value })}
                      rows={3}
                      placeholder="특이사항이나 추가 설명을 입력하세요..."
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* 디폴트 적용 버튼 */}
                  <div className="mt-4">
                    <button
                      onClick={() => {
                        const defaults = applyPreventionDefaults(editingFacility.name);
                        setEditingFacility({ 
                          ...editingFacility, 
                          ...defaults 
                        });
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800 underline"
                    >
                      시설 타입에 따른 디폴트 값 적용
                    </button>
                  </div>
                </div>
              )}

              {/* 방지시설에만 게이트웨이 번호 입력 */}
              {facilityType === 'prevention' && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <Router className="w-5 h-5" />
                    게이트웨이 정보
                  </h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      게이트웨이 번호
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editingFacility.gatewayInfo?.id || '0'}
                      onChange={(e) => setEditingFacility({ 
                        ...editingFacility, 
                        gatewayInfo: { ...editingFacility.gatewayInfo, id: e.target.value }
                      })}
                      placeholder="게이트웨이 번호를 입력하세요"
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleSaveFacility}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                저장
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 시설 정보 (대기필증 관리) - 접기/펼치기 */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
        >
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Factory className="w-6 h-6 text-blue-600" />
            측정기기 수량 체크
          </h2>
          {isCollapsed ? (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          )}
        </button>
        
        {!isCollapsed && (
          <div className="px-6 pb-6 space-y-6">
            {/* 측정기기 수량 요약 */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 shadow-sm border border-blue-100">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-blue-600" />
                측정기기 수량 현황
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-cyan-600">{equipmentCounts.phSensor}</div>
                  <div className="text-xs text-gray-600">pH계</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{equipmentCounts.differentialPressureMeter}</div>
                  <div className="text-xs text-gray-600">차압계</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{equipmentCounts.temperatureMeter}</div>
                  <div className="text-xs text-gray-600">온도계</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{equipmentCounts.dischargeCT}</div>
                  <div className="text-xs text-gray-600">배출CT</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{equipmentCounts.fanCT}</div>
                  <div className="text-xs text-gray-600">송풍CT</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{equipmentCounts.pumpCT}</div>
                  <div className="text-xs text-gray-600">펌프CT</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-indigo-600">{equipmentCounts.gateway}</div>
                  <div className="text-xs text-gray-600">게이트웨이</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-800">{equipmentCounts.totalDevices}</div>
                  <div className="text-xs text-gray-600">총 기기</div>
                </div>
              </div>
            </div>

            {/* 배출시설 목록 */}
            <div className="bg-white rounded-lg border border-gray-100 p-4">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Factory className="w-5 h-5 text-orange-600" />
                배출시설 ({facilities.discharge?.length || 0}개)
              </h3>
              
              {facilities.discharge && facilities.discharge.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {facilities.discharge.map(facility => renderFacilityCard(facility, 'discharge'))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  등록된 배출시설이 없습니다.
                </div>
              )}
            </div>

            {/* 방지시설 목록 */}
            <div className="bg-white rounded-lg border border-gray-100 p-4">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                방지시설 ({facilities.prevention?.length || 0}개)
              </h3>
              
              {facilities.prevention && facilities.prevention.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {facilities.prevention.map(facility => renderFacilityCard(facility, 'prevention'))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  등록된 방지시설이 없습니다.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showAddForm && renderEditForm()}
    </div>
  );
}