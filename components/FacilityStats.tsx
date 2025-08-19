import { FacilitiesData } from '@/types';
import { Factory, Zap, Shield, Target } from 'lucide-react';

interface FacilityStatsProps {
  facilities: FacilitiesData;
  loading: boolean;
}

function FacilityStats({ facilities, loading }: FacilityStatsProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center gap-2 mb-6">
          <Factory className="w-6 h-6 text-blue-600" />
          <h3 className="text-xl font-bold text-gray-900">시설 현황</h3>
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-lg p-4 animate-pulse">
              <div className="h-8 bg-gray-200 rounded mb-2" />
              <div className="h-4 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const outlets = new Set([
    ...facilities.discharge.map(f => f.outlet),
    ...facilities.prevention.map(f => f.outlet)
  ]);

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center gap-2 mb-6">
        <Factory className="w-6 h-6 text-blue-600" />
        <h3 className="text-xl font-bold text-gray-900">시설 현황</h3>
      </div>
      
      {/* 요약 통계만 표시 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border-2 border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">배출구</span>
          </div>
          <div className="text-2xl font-bold text-blue-600">
            {outlets.size}개
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border-2 border-red-200">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-red-600" />
            <span className="text-sm font-medium text-red-700">배출시설</span>
          </div>
          <div className="text-2xl font-bold text-red-600">
            {facilities.discharge.length}개
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border-2 border-green-200">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-700">방지시설</span>
          </div>
          <div className="text-2xl font-bold text-green-600">
            {facilities.prevention.length}개
          </div>
        </div>
      </div>

      {/* 데이터 없음 상태만 표시 */}
      {facilities.discharge.length === 0 && facilities.prevention.length === 0 && (
        <div className="text-center py-8 text-gray-500 mt-6">
          <Factory className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p>등록된 시설 정보가 없습니다.</p>
          <p className="text-sm mt-1">Google Sheets에서 시설 데이터를 확인해주세요.</p>
        </div>
      )}
    </div>
  );
}

export default FacilityStats;
