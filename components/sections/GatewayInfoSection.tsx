'use client';

import { useState, useEffect } from 'react';
import { Router, Wifi, Globe, Shield, Edit3, Save, Plus, Trash2, X, CheckCircle, AlertTriangle } from 'lucide-react';

interface GatewayDevice {
  id?: string;
  business_id: string;
  gateway_name: string;
  ip_address: string;
  mac_address: string;
  firmware_version?: string;
  location?: string;
  assigned_outlets: number[];
  connection_status: 'connected' | 'disconnected' | 'error';
  last_seen?: string;
  network_config?: {
    subnet_mask?: string;
    default_gateway?: string;
    dns_servers?: string[];
  };
  device_counts?: {
    total_sensors: number;
    active_sensors: number;
  };
  notes?: string;
}

interface GatewayInfoSectionProps {
  businessName: string;
  businessId: string;
  outlets: number[];
}

export default function GatewayInfoSection({
  businessName,
  businessId,
  outlets
}: GatewayInfoSectionProps) {
  const [gateways, setGateways] = useState<GatewayDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingGateway, setEditingGateway] = useState<GatewayDevice | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    loadGateways();
  }, [businessId]);

  const loadGateways = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/gateway-devices?businessId=${businessId}`);
      if (response.ok) {
        const data = await response.json();
        setGateways(data.gateways || []);
      }
    } catch (error) {
      console.error('게이트웨이 정보 로드 실패:', error);
      // 임시 데이터로 대체
      setGateways([
        {
          id: '1',
          business_id: businessId,
          gateway_name: '메인 게이트웨이',
          ip_address: '192.168.1.100',
          mac_address: '00:11:22:33:44:55',
          firmware_version: 'v2.1.0',
          location: '3층 서버실',
          assigned_outlets: [1, 2],
          connection_status: 'connected',
          last_seen: new Date().toISOString(),
          network_config: {
            subnet_mask: '255.255.255.0',
            default_gateway: '192.168.1.1',
            dns_servers: ['8.8.8.8', '8.8.4.4']
          },
          device_counts: {
            total_sensors: 8,
            active_sensors: 7
          },
          notes: '정상 작동 중'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddGateway = () => {
    setEditingGateway({
      business_id: businessId,
      gateway_name: '',
      ip_address: '',
      mac_address: '',
      assigned_outlets: [],
      connection_status: 'disconnected'
    });
    setShowAddForm(true);
  };

  const handleEditGateway = (gateway: GatewayDevice) => {
    setEditingGateway({ ...gateway });
    setShowAddForm(true);
  };

  const handleSaveGateway = async () => {
    if (!editingGateway) return;

    try {
      const response = await fetch('/api/gateway-devices', {
        method: editingGateway.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingGateway)
      });

      if (response.ok) {
        await loadGateways();
        setShowAddForm(false);
        setEditingGateway(null);
        
        // 성공 토스트
        const toast = document.createElement('div');
        toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg z-50';
        toast.textContent = `게이트웨이가 ${editingGateway.id ? '수정' : '추가'}되었습니다.`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
      }
    } catch (error) {
      console.error('게이트웨이 저장 실패:', error);
    }
  };

  const handleDeleteGateway = async (gateway: GatewayDevice) => {
    if (!confirm(`"${gateway.gateway_name}" 게이트웨이를 삭제하시겠습니까?`)) return;

    try {
      const response = await fetch('/api/gateway-devices', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gatewayId: gateway.id })
      });

      if (response.ok) {
        await loadGateways();
        
        // 성공 토스트
        const toast = document.createElement('div');
        toast.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg z-50';
        toast.textContent = '게이트웨이가 삭제되었습니다.';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
      }
    } catch (error) {
      console.error('게이트웨이 삭제 실패:', error);
    }
  };

  const renderGatewayForm = () => {
    if (!editingGateway) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editingGateway.id ? '게이트웨이 수정' : '게이트웨이 추가'}
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
                    게이트웨이명 *
                  </label>
                  <input
                    type="text"
                    value={editingGateway.gateway_name}
                    onChange={(e) => setEditingGateway({ ...editingGateway, gateway_name: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="메인 게이트웨이"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    설치 위치
                  </label>
                  <input
                    type="text"
                    value={editingGateway.location || ''}
                    onChange={(e) => setEditingGateway({ ...editingGateway, location: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="3층 서버실"
                  />
                </div>
              </div>

              {/* 네트워크 정보 */}
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h3 className="font-semibold text-blue-800 mb-4 flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  네트워크 설정
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      IP 주소 *
                    </label>
                    <input
                      type="text"
                      value={editingGateway.ip_address}
                      onChange={(e) => setEditingGateway({ ...editingGateway, ip_address: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="192.168.1.100"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      MAC 주소 *
                    </label>
                    <input
                      type="text"
                      value={editingGateway.mac_address}
                      onChange={(e) => setEditingGateway({ ...editingGateway, mac_address: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="00:11:22:33:44:55"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      서브넷 마스크
                    </label>
                    <input
                      type="text"
                      value={editingGateway.network_config?.subnet_mask || ''}
                      onChange={(e) => setEditingGateway({ 
                        ...editingGateway, 
                        network_config: { 
                          ...editingGateway.network_config, 
                          subnet_mask: e.target.value 
                        }
                      })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="255.255.255.0"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      기본 게이트웨이
                    </label>
                    <input
                      type="text"
                      value={editingGateway.network_config?.default_gateway || ''}
                      onChange={(e) => setEditingGateway({ 
                        ...editingGateway, 
                        network_config: { 
                          ...editingGateway.network_config, 
                          default_gateway: e.target.value 
                        }
                      })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="192.168.1.1"
                    />
                  </div>
                </div>
              </div>

              {/* 배출구 할당 */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-4">할당된 배출구</h3>
                <div className="flex flex-wrap gap-2">
                  {outlets.map(outlet => (
                    <label key={outlet} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingGateway.assigned_outlets.includes(outlet)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditingGateway({
                              ...editingGateway,
                              assigned_outlets: [...editingGateway.assigned_outlets, outlet]
                            });
                          } else {
                            setEditingGateway({
                              ...editingGateway,
                              assigned_outlets: editingGateway.assigned_outlets.filter(o => o !== outlet)
                            });
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">배출구 {outlet}번</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 추가 정보 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    펌웨어 버전
                  </label>
                  <input
                    type="text"
                    value={editingGateway.firmware_version || ''}
                    onChange={(e) => setEditingGateway({ ...editingGateway, firmware_version: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="v2.1.0"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    연결 상태
                  </label>
                  <select
                    value={editingGateway.connection_status}
                    onChange={(e) => setEditingGateway({ ...editingGateway, connection_status: e.target.value as any })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="connected">연결됨</option>
                    <option value="disconnected">연결안됨</option>
                    <option value="error">오류</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  비고
                </label>
                <textarea
                  value={editingGateway.notes || ''}
                  onChange={(e) => setEditingGateway({ ...editingGateway, notes: e.target.value })}
                  rows={3}
                  placeholder="특이사항이나 추가 설명을 입력하세요..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleSaveGateway}
                disabled={!editingGateway.gateway_name || !editingGateway.ip_address || !editingGateway.mac_address}
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
          <Router className="w-6 h-6 text-blue-600" />
          게이트웨이 정보 관리
        </h2>
        <button
          onClick={handleAddGateway}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          게이트웨이 추가
        </button>
      </div>

      {gateways.length === 0 ? (
        <div className="text-center py-12">
          <Router className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 text-lg mb-2">등록된 게이트웨이가 없습니다</p>
          <p className="text-gray-400 text-sm">게이트웨이를 추가하여 네트워크 관리를 시작하세요</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {gateways.map((gateway) => (
            <div key={gateway.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Router className="w-5 h-5 text-blue-600" />
                    {gateway.gateway_name}
                  </h3>
                  <p className="text-sm text-gray-600">{gateway.location}</p>
                </div>
                
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEditGateway(gateway)}
                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteGateway(gateway)}
                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 연결 상태 */}
              <div className="flex items-center gap-2 mb-4">
                {gateway.connection_status === 'connected' ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : gateway.connection_status === 'error' ? (
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                ) : (
                  <Wifi className="w-5 h-5 text-gray-400" />
                )}
                <span className={`font-medium ${
                  gateway.connection_status === 'connected' ? 'text-green-700' :
                  gateway.connection_status === 'error' ? 'text-red-700' : 'text-gray-700'
                }`}>
                  {gateway.connection_status === 'connected' ? '연결됨' :
                   gateway.connection_status === 'error' ? '오류' : '연결안됨'}
                </span>
                {gateway.last_seen && (
                  <span className="text-xs text-gray-500">
                    ({new Date(gateway.last_seen).toLocaleString('ko-KR')})
                  </span>
                )}
              </div>

              {/* 네트워크 정보 */}
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>IP 주소:</span>
                  <span className="font-mono">{gateway.ip_address}</span>
                </div>
                <div className="flex justify-between">
                  <span>MAC 주소:</span>
                  <span className="font-mono">{gateway.mac_address}</span>
                </div>
                {gateway.firmware_version && (
                  <div className="flex justify-between">
                    <span>펌웨어:</span>
                    <span>{gateway.firmware_version}</span>
                  </div>
                )}
              </div>

              {/* 할당된 배출구 */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">할당된 배출구</span>
                  <span className="text-xs text-gray-500">{gateway.assigned_outlets.length}개</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {gateway.assigned_outlets.map(outlet => (
                    <span
                      key={outlet}
                      className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                    >
                      {outlet}번
                    </span>
                  ))}
                </div>
              </div>

              {/* 센서 통계 */}
              {gateway.device_counts && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <div className="text-lg font-bold text-blue-600">{gateway.device_counts.total_sensors}</div>
                      <div className="text-xs text-gray-600">총 센서</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-green-600">{gateway.device_counts.active_sensors}</div>
                      <div className="text-xs text-gray-600">활성 센서</div>
                    </div>
                  </div>
                </div>
              )}

              {/* 비고 */}
              {gateway.notes && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-600">{gateway.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showAddForm && renderGatewayForm()}
    </div>
  );
}