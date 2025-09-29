'use client';

import React, { useState, useEffect } from 'react';
import { Building, Users, ChevronDown, ChevronRight } from 'lucide-react';

// 타입 정의
interface Department {
  id: number;
  name: string;
  description?: string;
  teams?: Team[];
}

interface Team {
  id: number;
  name: string;
  description?: string;
  department_id: number;
}

// 부서 노드 컴포넌트
const DepartmentNode: React.FC<{
  department: Department,
  isExpanded: boolean,
  onToggle: () => void
}> = ({ department, isExpanded, onToggle }) => {
  return (
    <div className="flex flex-col items-center">
      {/* 부서 박스 */}
      <div className="relative">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 rounded-lg shadow-lg min-w-[120px] sm:min-w-[160px] md:min-w-[200px] text-center border border-blue-500 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-center gap-2">
            <Building className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" />
            <span className="font-semibold text-xs sm:text-sm md:text-base lg:text-lg">{department.name}</span>
          </div>
          {department.teams && department.teams.length > 0 && (
            <button
              onClick={onToggle}
              className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 bg-white text-blue-600 rounded-full p-1 shadow-md hover:bg-blue-50 transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* 연결선 */}
      {isExpanded && department.teams && department.teams.length > 0 && (
        <div className="flex flex-col items-center">
          {/* 수직선 */}
          <div className="w-0.5 h-4 sm:h-6 md:h-8 bg-gray-300"></div>

          {/* 수평선과 팀들 */}
          <div className="relative flex items-center">
            {/* 수평선 */}
            {department.teams.length > 1 && (
              <div
                className="absolute top-0 h-0.5 bg-gray-300"
                style={{
                  left: `${100 / department.teams.length / 2}%`,
                  right: `${100 / department.teams.length / 2}%`
                }}
              ></div>
            )}

            {/* 팀 노드들 */}
            <div className="flex flex-wrap justify-center gap-3 sm:gap-4 md:gap-6 mt-4 sm:mt-6 md:mt-8">
              {department.teams.map((team, index) => (
                <div key={team.id} className="flex flex-col items-center">
                  {/* 팀으로의 연결선 */}
                  <div className="w-0.5 h-3 sm:h-4 md:h-6 bg-gray-300"></div>

                  {/* 팀 박스 */}
                  <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-3 rounded-lg shadow-md min-w-[100px] sm:min-w-[130px] md:min-w-[160px] text-center border border-green-400 hover:shadow-lg transition-all duration-300">
                    <div className="flex items-center justify-center gap-2">
                      <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="font-medium">{team.name}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 메인 조직도 컴포넌트
const OrganizationChart: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDepts, setExpandedDepts] = useState<Set<number>>(new Set());

  // 데이터 로드
  useEffect(() => {
    loadOrganizationData();
  }, []);

  const loadOrganizationData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/organization/departments');
      const data = await response.json();

      if (data.success) {
        setDepartments(data.data || []);
        // 기본적으로 모든 부서를 펼친 상태로 표시
        const allDeptIds = new Set((data.data || []).map((dept: Department) => dept.id));
        setExpandedDepts(allDeptIds);
      } else {
        setError('조직 데이터를 불러올 수 없습니다.');
      }
    } catch (err) {
      setError('조직 데이터 로드 중 오류가 발생했습니다.');
      console.error('Organization data load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDepartment = (deptId: number) => {
    setExpandedDepts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(deptId)) {
        newSet.delete(deptId);
      } else {
        newSet.add(deptId);
      }
      return newSet;
    });
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 md:p-8">
        <div className="flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-600 mx-auto mb-2 sm:mb-3 md:mb-4"></div>
            <p className="text-gray-600 text-sm sm:text-base">조직도를 불러오는 중...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 md:p-8">
        <div className="text-center">
          <p className="text-red-600 text-sm sm:text-base">{error}</p>
          <button
            onClick={loadOrganizationData}
            className="mt-3 sm:mt-4 px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* 헤더 - 모바일 최적화 */}
      <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Building className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-900">조직 현황</h2>
            <p className="text-xs sm:text-sm md:text-base text-gray-600">
              {departments.length}개 부서, {departments.reduce((acc, dept) => acc + (dept.teams?.length || 0), 0)}개 팀
            </p>
          </div>
        </div>
      </div>

      {/* 조직도 - 모바일 및 데스크톱 반응형 */}
      <div className="p-3 sm:p-4 md:p-8">
        {departments.length > 0 ? (
          <>
            {/* 모바일 버전: 심플 카드 리스트 */}
            <div className="block md:hidden space-y-3">
              {/* 회사 정보 */}
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-3 rounded-lg text-center">
                <div className="flex items-center justify-center gap-2">
                  <Building className="w-4 h-4" />
                  <span className="font-bold text-sm">주식회사 블루온</span>
                </div>
                <div className="text-xs mt-1 opacity-90">시설 관리 시스템</div>
              </div>

              {/* 부서 리스트 */}
              {departments.map((department) => (
                <div key={department.id} className="border border-gray-200 rounded-lg">
                  <button
                    onClick={() => toggleDepartment(department.id)}
                    className="w-full p-3 text-left flex items-center justify-between bg-blue-50 hover:bg-blue-100 transition-colors rounded-t-lg"
                  >
                    <div className="flex items-center gap-2">
                      <Building className="w-4 h-4 text-blue-600" />
                      <span className="font-medium text-sm text-gray-900">{department.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        {department.teams?.length || 0}개 팀
                      </span>
                      {department.teams && department.teams.length > 0 && (
                        expandedDepts.has(department.id) ? (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        )
                      )}
                    </div>
                  </button>

                  {/* 팀 리스트 */}
                  {expandedDepts.has(department.id) && department.teams && department.teams.length > 0 && (
                    <div className="border-t border-gray-200">
                      {department.teams.map((team) => (
                        <div key={team.id} className="flex items-center gap-2 p-3 bg-gray-50">
                          <Users className="w-3 h-3 text-green-600" />
                          <span className="text-xs text-gray-700">{team.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 데스크톱 버전: 복잡 차트 */}
            <div className="hidden md:block overflow-x-auto">
              <div className="flex flex-col items-center">
                {/* 회사명 (최상위) */}
                <div className="mb-8">
                  <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-4 rounded-xl shadow-lg text-center border border-indigo-500">
                    <div className="flex items-center justify-center gap-3">
                      <Building className="w-6 h-6" />
                      <span className="font-bold text-xl">주식회사 블루온</span>
                    </div>
                    <div className="text-sm mt-1 opacity-90">시설 관리 시스템</div>
                  </div>
                </div>

                {/* 연결선 */}
                <div className="w-0.5 h-8 bg-gray-300 mb-4"></div>

                {/* 부서들을 위한 수평선 */}
                {departments.length > 1 && (
                  <div className="relative mb-8 w-full max-w-4xl">
                    <div className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-gray-300"></div>
                  </div>
                )}

                {/* 부서들 */}
                <div className="flex flex-wrap justify-center gap-12 max-w-6xl">
                  {departments.map((department) => (
                    <DepartmentNode
                      key={department.id}
                      department={department}
                      isExpanded={expandedDepts.has(department.id)}
                      onToggle={() => toggleDepartment(department.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-6 sm:py-8 md:py-12">
            <Building className="w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 mx-auto text-gray-300 mb-2 sm:mb-3 md:mb-4" />
            <p className="text-gray-500 text-sm sm:text-base md:text-lg">조직 정보가 없습니다.</p>
            <p className="text-xs sm:text-sm md:text-base text-gray-400 mt-1 sm:mt-2">
              조직 관리에서 부서와 팀을 추가해보세요.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrganizationChart;