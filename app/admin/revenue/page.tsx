'use client';

import React, { useState, useEffect } from 'react';
import { withAuth, useAuth } from '@/contexts/AuthContext';
import { TokenManager } from '@/lib/api-client';
import AdminLayout from '@/components/ui/AdminLayout';
import StatsCard from '@/components/ui/StatsCard';
import Modal, { ModalActions } from '@/components/ui/Modal';
import {
  BarChart3,
  Calculator,
  TrendingUp,
  DollarSign,
  Building2,
  Calendar,
  FileText,
  Search,
  Filter,
  Download,
  Loader2,
  Settings
} from 'lucide-react';

interface BusinessInfo {
  id: string;
  business_name: string;
  sales_office: string;
  [key: string]: any;
}

interface RevenueCalculation {
  id: string;
  business_id: string;
  business_name: string;
  sales_office: string;
  calculation_date: string;
  total_revenue: number;
  total_cost: number;
  gross_profit: number;
  sales_commission: number;
  survey_costs: number;
  installation_costs: number;
  net_profit: number;
  equipment_breakdown: any[];
  cost_breakdown: any;
}

interface DashboardStats {
  total_businesses: number;
  total_revenue: number;
  total_profit: number;
  average_margin: string;
  top_performing_office: string;
}

function RevenueDashboard() {
  const [businesses, setBusinesses] = useState<BusinessInfo[]>([]);
  const [calculations, setCalculations] = useState<RevenueCalculation[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<string>('');
  const [selectedOffice, setSelectedOffice] = useState<string>('');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [revenueFilter, setRevenueFilter] = useState({
    min: '',
    max: ''
  });
  const [selectedRegion, setSelectedRegion] = useState('');
  const [sortField, setSortField] = useState<string>('business_name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // AuthContext에서 권한 정보 가져오기
  const { user, permissions } = useAuth();
  const userPermission = user?.permission_level || 0;

  useEffect(() => {
    // 데이터 로드
    loadBusinesses();
    loadCalculations();
  }, []);

  const getAuthHeaders = () => {
    const token = TokenManager.getToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  const loadBusinesses = async () => {
    try {
      const response = await fetch('/api/business-list', {
        headers: getAuthHeaders()
      });
      const data = await response.json();

      if (data.success) {
        setBusinesses(data.data.businesses || []);
      }
    } catch (error) {
      console.error('사업장 목록 로드 오류:', error);
    }
  };

  const loadCalculations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedBusiness) params.append('business_id', selectedBusiness);
      if (selectedOffice) params.append('sales_office', selectedOffice);
      if (dateRange.start) params.append('start_date', dateRange.start);
      if (dateRange.end) params.append('end_date', dateRange.end);
      params.append('limit', '100');

      const response = await fetch(`/api/revenue/calculate?${params}`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();

      if (data.success) {
        setCalculations(data.data.calculations || []);
        calculateStats(data.data.calculations || []);
      }
    } catch (error) {
      console.error('계산 결과 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (calcs: RevenueCalculation[]) => {
    if (!calcs.length) {
      setStats(null);
      return;
    }

    const totalRevenue = calcs.reduce((sum, calc) => sum + calc.total_revenue, 0);
    const totalProfit = calcs.reduce((sum, calc) => sum + calc.net_profit, 0);
    const avgMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0';

    // 영업점별 수익 계산
    const officeStats = calcs.reduce((acc, calc) => {
      const office = calc.sales_office || '기본';
      if (!acc[office]) {
        acc[office] = { revenue: 0, profit: 0 };
      }
      acc[office].revenue += calc.total_revenue;
      acc[office].profit += calc.net_profit;
      return acc;
    }, {} as Record<string, {revenue: number, profit: number}>);

    const topOffice = Object.entries(officeStats)
      .sort(([,a], [,b]) => b.profit - a.profit)[0]?.[0] || '';

    setStats({
      total_businesses: new Set(calcs.map(c => c.business_id)).size,
      total_revenue: totalRevenue,
      total_profit: totalProfit,
      average_margin: avgMargin + '%',
      top_performing_office: topOffice
    });
  };

  const calculateRevenue = async (businessId: string) => {
    if (!businessId) return;

    setIsCalculating(true);
    try {
      const response = await fetch('/api/revenue/calculate', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          business_id: businessId,
          calculation_date: new Date().toISOString().split('T')[0],
          save_result: userPermission >= 3
        })
      });

      const data = await response.json();

      if (data.success) {
        alert('매출 계산이 완료되었습니다.');
        loadCalculations();
      } else {
        alert('계산 실패: ' + data.message);
      }
    } catch (error) {
      console.error('매출 계산 오류:', error);
      alert('매출 계산 중 오류가 발생했습니다.');
    } finally {
      setIsCalculating(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(amount);
  };

  const exportData = () => {
    if (!calculations.length) {
      alert('내보낼 데이터가 없습니다.');
      return;
    }

    const csvData = calculations.map(calc => ({
      '계산일': calc.calculation_date,
      '사업장명': calc.business_name,
      '영업점': calc.sales_office,
      '총 매출': calc.total_revenue,
      '총 매입': calc.total_cost,
      '총 이익': calc.gross_profit,
      '영업비용': calc.sales_commission,
      '실사비용': calc.survey_costs,
      '설치비용': calc.installation_costs,
      '순이익': calc.net_profit,
      '이익률': ((calc.net_profit / calc.total_revenue) * 100).toFixed(2) + '%'
    }));

    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `매출관리_${dateRange.start}_${dateRange.end}.csv`;
    link.click();
  };

  const filteredCalculations = calculations.filter(calc =>
    !searchTerm ||
    calc.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    calc.sales_office.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 사업장 데이터와 매출 계산 통합
  const filteredBusinesses = businesses.filter(business =>
    (!searchTerm ||
    business.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (business.sales_office && business.sales_office.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (business.contact_person && business.contact_person.toLowerCase().includes(searchTerm.toLowerCase()))) &&
    (!selectedOffice || business.sales_office === selectedOffice) &&
    (!selectedRegion || (business.address && business.address.toLowerCase().includes(selectedRegion.toLowerCase())))
  ).map(business => {
    // 해당 사업장의 매출 계산 결과 찾기 (가장 최신)
    const revenueCalc = calculations
      .filter(calc => calc.business_name === business.business_name)
      .sort((a, b) => new Date(b.calculation_date).getTime() - new Date(a.calculation_date).getTime())[0];

    // 기기 수 계산
    const equipmentFields = [
      'ph_meter', 'differential_pressure_meter', 'temperature_meter',
      'discharge_current_meter', 'fan_current_meter', 'pump_current_meter',
      'gateway', 'vpn_wired', 'vpn_wireless',
      'explosion_proof_differential_pressure_meter_domestic',
      'explosion_proof_temperature_meter_domestic', 'expansion_device',
      'relay_8ch', 'relay_16ch', 'main_board_replacement', 'multiple_stack'
    ];

    const totalEquipment = equipmentFields.reduce((sum, field) => {
      return sum + (business[field as keyof BusinessInfo] as number || 0);
    }, 0);

    return {
      ...business,
      total_revenue: revenueCalc?.total_revenue || 0,
      total_cost: revenueCalc?.total_cost || 0,
      net_profit: revenueCalc?.net_profit || 0,
      gross_profit: revenueCalc?.gross_profit || 0,
      equipment_count: totalEquipment,
      calculation_date: revenueCalc?.calculation_date || null,
      category: 'N/A' // TODO: 업무 관리에서 카테고리 정보 가져오기
    };
  }).filter(business => {
    // 매출 금액 필터 적용
    const minRevenue = revenueFilter.min ? parseFloat(revenueFilter.min) : 0;
    const maxRevenue = revenueFilter.max ? parseFloat(revenueFilter.max) : Number.MAX_SAFE_INTEGER;
    return business.total_revenue >= minRevenue && business.total_revenue <= maxRevenue;
  });

  const salesOffices = [...new Set(businesses.map(b => b.sales_office).filter(Boolean))];
  const regions = [...new Set(businesses.map(b => b.address ? b.address.split(' ').slice(0, 2).join(' ') : '').filter(Boolean))];

  // 정렬 함수
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setCurrentPage(1); // 정렬시 첫 페이지로 이동
  };

  // 정렬된 데이터
  const sortedBusinesses = [...filteredBusinesses].sort((a, b) => {
    const aValue = a[sortField as keyof typeof a] || '';
    const bValue = b[sortField as keyof typeof b] || '';

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    }

    const aStr = String(aValue).toLowerCase();
    const bStr = String(bValue).toLowerCase();
    return sortOrder === 'asc'
      ? aStr.localeCompare(bStr)
      : bStr.localeCompare(aStr);
  });

  // 페이지네이션
  const totalPages = Math.ceil(sortedBusinesses.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedBusinesses = sortedBusinesses.slice(startIndex, startIndex + itemsPerPage);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* 헤더 */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">매출 관리 대시보드</h1>
            <p className="text-gray-600 mt-1">환경부 고시가 기준 매출 현황 및 분석</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => window.location.href = '/admin/revenue/pricing'}
              disabled={userPermission < 3}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              <DollarSign className="w-4 h-4" />
              원가 관리
            </button>
            <button
              onClick={exportData}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4" />
              엑셀 내보내기
            </button>
          </div>
        </div>

        {/* 통계 카드 */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="총 사업장 수"
              value={`${stats.total_businesses}개`}
              icon={Building2}
              color="blue"
            />

            <StatsCard
              title="총 매출"
              value={formatCurrency(stats.total_revenue)}
              icon={BarChart3}
              color="green"
            />

            <StatsCard
              title="총 순이익"
              value={formatCurrency(stats.total_profit)}
              icon={TrendingUp}
              color="purple"
              description={`평균 이익률: ${stats.average_margin}`}
            />

            <StatsCard
              title="최고 수익 영업점"
              value={stats.top_performing_office}
              icon={DollarSign}
              color="indigo"
            />
          </div>
        )}

        {/* 필터 및 검색 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Filter className="w-5 h-5" />
            필터 및 검색
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">사업장 선택</label>
              <select
                value={selectedBusiness}
                onChange={(e) => setSelectedBusiness(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">전체 사업장</option>
                {businesses.map(business => (
                  <option key={business.id} value={business.id}>
                    {business.business_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">영업점</label>
              <select
                value={selectedOffice}
                onChange={(e) => setSelectedOffice(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">전체 영업점</option>
                {salesOffices.map(office => (
                  <option key={office} value={office}>
                    {office}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">지역</label>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">전체 지역</option>
                {regions.sort().map(region => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">시작일</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">종료일</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-end gap-2">
              <button
                onClick={loadCalculations}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                <Search className="w-4 h-4" />
                조회
              </button>
              {selectedBusiness && (
                <button
                  onClick={() => calculateRevenue(selectedBusiness)}
                  disabled={isCalculating}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                >
                  <Calculator className="w-4 h-4" />
                  {isCalculating ? '계산 중...' : '계산'}
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">검색</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="사업장명 또는 영업점으로 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">최소 매출금액 (원)</label>
              <input
                type="number"
                placeholder="0"
                value={revenueFilter.min}
                onChange={(e) => setRevenueFilter(prev => ({ ...prev, min: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min="0"
                step="100000"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">최대 매출금액 (원)</label>
              <input
                type="number"
                placeholder="제한없음"
                value={revenueFilter.max}
                onChange={(e) => setRevenueFilter(prev => ({ ...prev, max: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min="0"
                step="100000"
              />
            </div>
          </div>
        </div>

        {/* 요약 통계 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">총 사업장</p>
                <p className="text-2xl font-bold text-gray-900">{sortedBusinesses.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">총 매출금액</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(sortedBusinesses.reduce((sum, b) => sum + b.total_revenue, 0))}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <DollarSign className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">총 이익금액</p>
                <p className="text-2xl font-bold text-purple-600">
                  {formatCurrency(sortedBusinesses.reduce((sum, b) => sum + b.net_profit, 0))}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-50 rounded-lg">
                <Settings className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">총 설치기기</p>
                <p className="text-2xl font-bold text-orange-600">
                  {sortedBusinesses.reduce((sum, b) => sum + b.equipment_count, 0)}대
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 사업장별 매출 현황 테이블 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                사업장별 매출 현황 ({sortedBusinesses.length}건)
              </h3>
              <div className="text-sm text-gray-500">
                평균 이익률: {sortedBusinesses.length > 0 ?
                  ((sortedBusinesses.reduce((sum, b) => sum + (b.total_revenue > 0 ? (b.net_profit / b.total_revenue * 100) : 0), 0) / sortedBusinesses.length)).toFixed(1)
                  : '0'}%
              </div>
            </div>
          </div>
          <div className="p-6">
            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                <div className="text-gray-500">사업장 매출 데이터를 불러오는 중...</div>
              </div>
            ) : sortedBusinesses.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-500">조회된 사업장이 없습니다.</div>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-50">
                        <th
                          className="border border-gray-300 px-4 py-2 text-left cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('business_name')}
                        >
                          사업장명 {sortField === 'business_name' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="border border-gray-300 px-4 py-2 text-left">지역</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">담당자</th>
                        <th className="border border-gray-300 px-4 py-2 text-center">카테고리</th>
                        <th
                          className="border border-gray-300 px-4 py-2 text-left cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('sales_office')}
                        >
                          영업점 {sortField === 'sales_office' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th
                          className="border border-gray-300 px-4 py-2 text-right cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('total_revenue')}
                        >
                          매출금액 {sortField === 'total_revenue' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th
                          className="border border-gray-300 px-4 py-2 text-right cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('total_cost')}
                        >
                          매입금액 {sortField === 'total_cost' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th
                          className="border border-gray-300 px-4 py-2 text-right cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('net_profit')}
                        >
                          이익금액 {sortField === 'net_profit' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="border border-gray-300 px-4 py-2 text-right">이익률</th>
                        <th
                          className="border border-gray-300 px-4 py-2 text-center cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('equipment_count')}
                        >
                          기기수 {sortField === 'equipment_count' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedBusinesses.map((business) => {
                        const profitMargin = business.total_revenue > 0
                          ? ((business.net_profit / business.total_revenue) * 100).toFixed(1)
                          : '0';

                        return (
                          <tr key={business.id} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-4 py-2 font-medium">
                              {business.business_name}
                            </td>
                            <td className="border border-gray-300 px-4 py-2">
                              {business.address ? business.address.split(' ').slice(0, 2).join(' ') : '미등록'}
                            </td>
                            <td className="border border-gray-300 px-4 py-2">
                              {business.contact_person || '미등록'}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-center">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                {business.category}
                              </span>
                            </td>
                            <td className="border border-gray-300 px-4 py-2">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {business.sales_office || '미배정'}
                              </span>
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right font-mono">
                              {formatCurrency(business.total_revenue)}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right font-mono">
                              {formatCurrency(business.total_cost)}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right font-mono font-bold">
                              <span className={business.net_profit >= 0 ? 'text-blue-600' : 'text-red-600'}>
                                {formatCurrency(business.net_profit)}
                              </span>
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                parseFloat(profitMargin) >= 10 ? 'bg-green-100 text-green-800' :
                                parseFloat(profitMargin) >= 5 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {profitMargin}%
                              </span>
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-center">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                {business.equipment_count}대
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 페이지네이션 */}
                {totalPages > 1 && (
                  <div className="mt-4 flex justify-between items-center">
                    <div className="text-sm text-gray-500">
                      {startIndex + 1}-{Math.min(startIndex + itemsPerPage, sortedBusinesses.length)} / {sortedBusinesses.length}건
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        이전
                      </button>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const startPage = Math.max(1, currentPage - 2);
                        const pageNumber = startPage + i;
                        if (pageNumber > totalPages) return null;

                        return (
                          <button
                            key={pageNumber}
                            onClick={() => setCurrentPage(pageNumber)}
                            className={`px-3 py-1 text-sm border border-gray-300 rounded ${
                              currentPage === pageNumber
                                ? 'bg-blue-500 text-white border-blue-500'
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            {pageNumber}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        다음
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

// withAuth HOC로 권한 체크 (권한 2 이상 필요)
export default withAuth(RevenueDashboard, undefined, 2);