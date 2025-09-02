'use client';

import { BarChart3, Factory, Shield, Zap } from 'lucide-react';
import { FacilitiesData } from '@/types';

interface FacilityOverviewSectionProps {
  facilities: FacilitiesData;
}

export default function FacilityOverviewSection({ facilities }: FacilityOverviewSectionProps) {
  const dischargeCount = facilities.discharge?.length || 0;
  const preventionCount = facilities.prevention?.length || 0;
  
  // Calculate unique outlet count
  const outletCount = new Set([
    ...(facilities.discharge || []).map(f => f.outlet),
    ...(facilities.prevention || []).map(f => f.outlet)
  ]).size;

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-sm border border-gray-100/50">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-green-100 rounded-lg">
          <BarChart3 className="w-6 h-6 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-800">시설 현황</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg p-4 text-center shadow-sm border border-gray-100">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Factory className="w-5 h-5 text-orange-500" />
            <h3 className="text-sm font-medium text-gray-600">배출시설</h3>
          </div>
          <p className="text-2xl font-bold text-orange-600">{dischargeCount}</p>
          <p className="text-xs text-gray-500">개</p>
        </div>
        
        <div className="bg-white rounded-lg p-4 text-center shadow-sm border border-gray-100">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-blue-500" />
            <h3 className="text-sm font-medium text-gray-600">방지시설</h3>
          </div>
          <p className="text-2xl font-bold text-blue-600">{preventionCount}</p>
          <p className="text-xs text-gray-500">개</p>
        </div>
        
        <div className="bg-white rounded-lg p-4 text-center shadow-sm border border-gray-100">
          <div className="flex items-center justify-center gap-2 mb-2">
            <BarChart3 className="w-5 h-5 text-green-500" />
            <h3 className="text-sm font-medium text-gray-600">배출구</h3>
          </div>
          <p className="text-2xl font-bold text-green-600">{outletCount}</p>
          <p className="text-xs text-gray-500">개</p>
        </div>
      </div>
    </div>
  );
}