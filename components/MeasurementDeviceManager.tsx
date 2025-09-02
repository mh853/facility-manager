'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, Save, X, Wifi, Thermometer, Droplets, Zap, Router, AlertTriangle } from 'lucide-react';

// 타입 정의
interface MeasurementDevice {
  id?: string;
  business_id: string;
  device_type: string;
  device_name: string;
  model_number?: string;
  serial_number?: string;
  manufacturer?: string;
  installation_location?: string;
  measurement_range?: string;
  accuracy?: string;
  
  // CT 관련
  ct_ratio?: string;
  primary_current?: string;
  secondary_current?: string;
  
  // 게이트웨이 관련
  ip_address?: string;
  mac_address?: string;
  firmware_version?: string;
  communication_protocol?: string;
  
  device_status: 'normal' | 'maintenance' | 'error' | 'inactive';
  current_value?: number;
  unit?: string;
  calibration_date?: string;
  next_calibration_date?: string;
  last_maintenance_date?: string;
  next_maintenance_date?: string;
}

interface MeasurementDeviceManagerProps {
  businessName: string;
  businessId: string;
}

// 기기 타입별 설정
const deviceTypeConfig = {
  gateway: {
    label: 'IoT 게이트웨이',
    icon: Router,
    color: 'text-blue-600',
    fields: ['ip_address', 'mac_address', 'firmware_version', 'communication_protocol']
  },
  ph_meter: {
    label: 'pH 측정기',
    icon: Droplets,
    color: 'text-cyan-600',
    fields: ['measurement_range', 'accuracy', 'calibration_date']
  },
  differential_pressure_meter: {
    label: '차압계',
    icon: Zap,
    color: 'text-purple-600',
    fields: ['measurement_range', 'accuracy', 'calibration_date']
  },
  temperature_meter: {
    label: '온도계',
    icon: Thermometer,
    color: 'text-red-600',
    fields: ['measurement_range', 'accuracy', 'calibration_date']
  },
  ct_meter: {
    label: 'CT 측정기',
    icon: Zap,
    color: 'text-orange-600',
    fields: ['ct_ratio', 'primary_current', 'secondary_current', 'calibration_date']
  }
};

export default function MeasurementDeviceManager({ 
  businessName, 
  businessId 
}: MeasurementDeviceManagerProps) {
  const [devices, setDevices] = useState<MeasurementDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDevice, setEditingDevice] = useState<MeasurementDevice | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<Partial<MeasurementDevice>>({});

  useEffect(() => {
    loadDevices();
  }, [businessId]);

  const loadDevices = async () => {
    setLoading(true);
    try {
      // 실제 API 호출로 교체 예정
      // const response = await fetch(`/api/measurement-devices?businessId=${businessId}`);
      // const data = await response.json();
      
      // 임시 데이터
      setDevices([
        {
          id: '1',
          business_id: businessId,
          device_type: 'gateway',
          device_name: 'IoT 게이트웨이',
          model_number: 'GW-2000',
          serial_number: 'GW20250001',
          manufacturer: 'TechCorp',
          ip_address: '192.168.1.100',
          mac_address: '00:11:22:33:44:55',
          firmware_version: 'v2.1.0',
          communication_protocol: 'TCP/IP',
          device_status: 'normal',
          installation_location: '3층 서버실'
        },
        {
          id: '2',
          business_id: businessId,
          device_type: 'ph_meter',
          device_name: 'pH 측정기',
          model_number: 'PH-500',
          serial_number: 'PH20250001',
          manufacturer: 'MeasureTech',
          measurement_range: '0-14 pH',
          accuracy: '±0.01',
          device_status: 'maintenance',
          current_value: 7.2,
          unit: 'pH',
          calibration_date: '2025-08-01',
          next_calibration_date: '2026-08-01',
          installation_location: '배출구 1번'
        }
      ]);
    } catch (error) {
      console.error('측정기기 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDevice = () => {
    setFormData({
      business_id: businessId,
      device_status: 'normal'
    });
    setShowAddForm(true);
  };

  const handleEditDevice = (device: MeasurementDevice) => {
    setFormData({ ...device });
    setEditingDevice(device);
    setShowAddForm(true);
  };

  const handleSaveDevice = async () => {
    try {
      if (editingDevice) {
        // 수정
        setDevices(prev => prev.map(d => 
          d.id === editingDevice.id ? { ...formData as MeasurementDevice } : d
        ));
      } else {
        // 추가
        const newDevice = {
          ...formData,
          id: Date.now().toString()
        } as MeasurementDevice;
        setDevices(prev => [...prev, newDevice]);
      }
      
      handleCancelEdit();
      
      // 성공 토스트
      const toast = document.createElement('div');
      toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg z-50';
      toast.textContent = `측정기기가 ${editingDevice ? '수정' : '추가'}되었습니다.`;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
      
    } catch (error) {
      console.error('측정기기 저장 실패:', error);
    }
  };

  const handleDeleteDevice = async (device: MeasurementDevice) => {
    if (!confirm(`"${device.device_name}" 측정기기를 삭제하시겠습니까?`)) return;
    
    try {
      setDevices(prev => prev.filter(d => d.id !== device.id));
      
      // 성공 토스트
      const toast = document.createElement('div');
      toast.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg z-50';
      toast.textContent = `측정기기가 삭제되었습니다.`;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
      
    } catch (error) {
      console.error('측정기기 삭제 실패:', error);
    }
  };

  const handleCancelEdit = () => {
    setShowAddForm(false);
    setEditingDevice(null);
    setFormData({});
  };

  const renderDeviceForm = () => {
    const deviceType = formData.device_type;
    const config = deviceType ? deviceTypeConfig[deviceType as keyof typeof deviceTypeConfig] : null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editingDevice ? '측정기기 수정' : '측정기기 추가'}
              </h2>
              <button
                onClick={handleCancelEdit}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* 기기 타입 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  기기 타입 *
                </label>
                <select
                  value={formData.device_type || ''}
                  onChange={(e) => setFormData({ ...formData, device_type: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">선택하세요</option>
                  {Object.entries(deviceTypeConfig).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </select>
              </div>

              {/* 기본 정보 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    기기명 *
                  </label>
                  <input
                    type="text"
                    value={formData.device_name || ''}
                    onChange={(e) => setFormData({ ...formData, device_name: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    모델명
                  </label>
                  <input
                    type="text"
                    value={formData.model_number || ''}
                    onChange={(e) => setFormData({ ...formData, model_number: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    시리얼 번호
                  </label>
                  <input
                    type="text"
                    value={formData.serial_number || ''}
                    onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    제조사
                  </label>
                  <input
                    type="text"
                    value={formData.manufacturer || ''}
                    onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  설치 위치
                </label>
                <input
                  type="text"
                  value={formData.installation_location || ''}
                  onChange={(e) => setFormData({ ...formData, installation_location: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* 기기 타입별 특수 필드 */}
              {config && config.fields.includes('measurement_range') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      측정 범위
                    </label>
                    <input
                      type="text"
                      value={formData.measurement_range || ''}
                      onChange={(e) => setFormData({ ...formData, measurement_range: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      정확도
                    </label>
                    <input
                      type="text"
                      value={formData.accuracy || ''}
                      onChange={(e) => setFormData({ ...formData, accuracy: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              {/* CT 관련 필드 */}
              {config && config.fields.some(f => f.startsWith('ct_')) && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      CT 비율
                    </label>
                    <input
                      type="text"
                      value={formData.ct_ratio || ''}
                      onChange={(e) => setFormData({ ...formData, ct_ratio: e.target.value })}
                      placeholder="예: 100:1"
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      1차 전류
                    </label>
                    <input
                      type="text"
                      value={formData.primary_current || ''}
                      onChange={(e) => setFormData({ ...formData, primary_current: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      2차 전류
                    </label>
                    <input
                      type="text"
                      value={formData.secondary_current || ''}
                      onChange={(e) => setFormData({ ...formData, secondary_current: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              {/* 게이트웨이 관련 필드 */}
              {config && config.fields.some(f => f.includes('ip_') || f.includes('mac_')) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      IP 주소
                    </label>
                    <input
                      type="text"
                      value={formData.ip_address || ''}
                      onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                      placeholder="192.168.1.100"
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      MAC 주소
                    </label>
                    <input
                      type="text"
                      value={formData.mac_address || ''}
                      onChange={(e) => setFormData({ ...formData, mac_address: e.target.value })}
                      placeholder="00:11:22:33:44:55"
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      펌웨어 버전
                    </label>
                    <input
                      type="text"
                      value={formData.firmware_version || ''}
                      onChange={(e) => setFormData({ ...formData, firmware_version: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      통신 프로토콜
                    </label>
                    <input
                      type="text"
                      value={formData.communication_protocol || ''}
                      onChange={(e) => setFormData({ ...formData, communication_protocol: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              {/* 상태 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  기기 상태
                </label>
                <select
                  value={formData.device_status || 'normal'}
                  onChange={(e) => setFormData({ ...formData, device_status: e.target.value as any })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="normal">정상</option>
                  <option value="maintenance">점검중</option>
                  <option value="error">오류</option>
                  <option value="inactive">비활성</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleSaveDevice}
                disabled={!formData.device_type || !formData.device_name}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
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

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Zap className="w-6 h-6 text-blue-600" />
          측정기기 관리
        </h2>
        <button
          onClick={handleAddDevice}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          측정기기 추가
        </button>
      </div>

      {devices.length === 0 ? (
        <div className="text-center py-12">
          <Zap className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 text-lg mb-2">등록된 측정기기가 없습니다</p>
          <p className="text-gray-400 text-sm">측정기기를 추가하여 관리를 시작하세요</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((device) => {
            const config = deviceTypeConfig[device.device_type as keyof typeof deviceTypeConfig];
            const Icon = config?.icon || Zap;
            const statusColor = device.device_status === 'normal' ? 'bg-green-100 text-green-800' :
                              device.device_status === 'maintenance' ? 'bg-orange-100 text-orange-800' :
                              device.device_status === 'error' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800';

            return (
              <div key={device.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-5 h-5 ${config?.color || 'text-gray-600'}`} />
                    <div>
                      <h3 className="font-semibold text-gray-900">{device.device_name}</h3>
                      <p className="text-sm text-gray-600">{config?.label}</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEditDevice(device)}
                      className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteDevice(device)}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  {device.model_number && (
                    <p className="text-gray-600">모델: {device.model_number}</p>
                  )}
                  {device.serial_number && (
                    <p className="text-gray-600">S/N: {device.serial_number}</p>
                  )}
                  {device.installation_location && (
                    <p className="text-gray-600">위치: {device.installation_location}</p>
                  )}
                  
                  {device.current_value !== undefined && (
                    <p className="font-medium text-gray-900">
                      현재값: {device.current_value} {device.unit}
                    </p>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                    {device.device_status === 'normal' && '정상'}
                    {device.device_status === 'maintenance' && '점검중'}
                    {device.device_status === 'error' && '오류'}
                    {device.device_status === 'inactive' && '비활성'}
                  </span>
                  
                  {device.device_status === 'error' && (
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAddForm && renderDeviceForm()}
    </div>
  );
}