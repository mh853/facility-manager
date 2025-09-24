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
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 rounded-lg shadow-lg min-w-[200px] text-center border border-blue-500 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-center gap-2">
            <Building className="w-5 h-5" />
            <span className="font-semibold text-lg">{department.name}</span>
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
          <div className="w-0.5 h-8 bg-gray-300"></div>

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
            <div className="flex gap-6 mt-8">
              {department.teams.map((team, index) => (
                <div key={team.id} className="flex flex-col items-center">
                  {/* 팀으로의 연결선 */}
                  <div className="w-0.5 h-6 bg-gray-300"></div>

                  {/* 팀 박스 */}
                  <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-3 rounded-lg shadow-md min-w-[160px] text-center border border-green-400 hover:shadow-lg transition-all duration-300">
                    <div className="flex items-center justify-center gap-2">
                      <Users className="w-4 h-4" />
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
      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <div className="flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">조직도를 불러오는 중...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <button
            onClick={loadOrganizationData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Building className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">조직 현황</h2>
            <p className="text-sm text-gray-600">
              {departments.length}개 부서, {departments.reduce((acc, dept) => acc + (dept.teams?.length || 0), 0)}개 팀
            </p>
          </div>
        </div>
      </div>

      {/* 조직도 */}
      <div className="p-8 overflow-x-auto">
        {departments.length > 0 ? (
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
        ) : (
          <div className="text-center py-12">
            <Building className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg">조직 정보가 없습니다.</p>
            <p className="text-sm text-gray-400 mt-2">
              조직 관리에서 부서와 팀을 추가해보세요.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrganizationChart;