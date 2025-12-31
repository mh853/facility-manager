'use client';

import { useState, useEffect } from 'react';

// ============================================================
// 크롤링 실행 모니터링 대시보드
// ============================================================
// 목적: 크롤링 실행 이력 및 성과 추적
// 경로: /admin/subsidy/monitoring
// ============================================================

interface CrawlRun {
  id: string;
  run_id: string;
  trigger_type: 'scheduled' | 'manual';
  status: 'running' | 'completed' | 'failed' | 'partial';
  started_at: string;
  completed_at: string | null;
  total_batches: number;
  completed_batches: number;
  total_urls_crawled: number;
  successful_urls: number;
  failed_urls: number;
  total_announcements: number;
  new_announcements: number;
  relevant_announcements: number;
  ai_verified_announcements: number;
  github_run_id: string | null;
}

interface RunsData {
  runs: CrawlRun[];
  statistics: {
    total_runs: number;
    avg_success_rate: number;
    avg_relevance_rate: number;
    avg_ai_verification_rate: number;
  };
}

export default function MonitoringDashboard() {
  const [data, setData] = useState<RunsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(20);

  useEffect(() => {
    loadRuns();
  }, [limit]);

  const loadRuns = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/subsidy-crawler/runs?limit=${limit}&offset=0`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        console.error('Failed to load runs:', result.error);
      }
    } catch (error) {
      console.error('Error loading runs:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">데이터를 불러올 수 없습니다.</p>
          <button
            onClick={loadRuns}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* 제목 */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">📊 크롤링 모니터링</h1>
        <button
          onClick={loadRuns}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          🔄 새로고침
        </button>
      </div>

      {/* 요약 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="전체 실행"
          value={data.statistics.total_runs}
          icon="📈"
        />
        <StatCard
          label="평균 성공률"
          value={`${data.statistics.avg_success_rate.toFixed(1)}%`}
          icon="✅"
          color="green"
        />
        <StatCard
          label="평균 관련도"
          value={`${data.statistics.avg_relevance_rate.toFixed(1)}%`}
          icon="🎯"
          color="blue"
        />
        <StatCard
          label="AI 검증률"
          value={`${data.statistics.avg_ai_verification_rate.toFixed(1)}%`}
          icon="🤖"
          color="purple"
        />
      </div>

      {/* 표시 개수 선택 */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600">표시 개수:</label>
        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="px-3 py-1 border border-gray-300 rounded-lg"
        >
          <option value={10}>10개</option>
          <option value={20}>20개</option>
          <option value={50}>50개</option>
          <option value={100}>100개</option>
        </select>
      </div>

      {/* 크롤링 실행 목록 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">크롤링 실행 이력</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  실행 ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  실행 시간
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  배치 (완료/전체)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  URL (성공/전체)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  공고 (전체/관련/AI)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  성공률
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.runs.map(run => (
                <RunRow key={run.id} run={run} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 안내 메시지 */}
      {data.runs.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>아직 크롤링 실행 기록이 없습니다.</p>
          <p className="text-sm mt-2">크롤링이 실행되면 여기에 표시됩니다.</p>
        </div>
      )}
    </div>
  );
}

// 통계 카드 컴포넌트
function StatCard({ label, value, icon, color }: {
  label: string;
  value: string | number;
  icon: string;
  color?: 'green' | 'blue' | 'purple';
}) {
  const bgColor = color === 'green' ? 'bg-green-50 border-green-200' :
                  color === 'blue' ? 'bg-blue-50 border-blue-200' :
                  color === 'purple' ? 'bg-purple-50 border-purple-200' :
                  'bg-gray-50 border-gray-200';

  return (
    <div className={`${bgColor} border rounded-lg p-6 transition-shadow hover:shadow-md`}>
      <div className="text-4xl mb-2">{icon}</div>
      <div className="text-3xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-600 mt-1">{label}</div>
    </div>
  );
}

// 실행 행 컴포넌트
function RunRow({ run }: { run: CrawlRun }) {
  const statusColor = run.status === 'completed' ? 'text-green-600 bg-green-50' :
                      run.status === 'running' ? 'text-blue-600 bg-blue-50' :
                      run.status === 'failed' ? 'text-red-600 bg-red-50' :
                      'text-yellow-600 bg-yellow-50';

  const statusIcon = run.status === 'completed' ? '✅' :
                     run.status === 'running' ? '🔄' :
                     run.status === 'failed' ? '❌' : '⚠️';

  const statusText = run.status === 'completed' ? '완료' :
                     run.status === 'running' ? '실행 중' :
                     run.status === 'failed' ? '실패' : '부분 완료';

  const successRate = run.total_urls_crawled > 0
    ? ((run.successful_urls / run.total_urls_crawled) * 100).toFixed(1)
    : '0.0';

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-gray-900">{run.run_id}</div>
        <div className="text-xs text-gray-500">
          {run.trigger_type === 'scheduled' ? '⏰ 예약' : '▶️ 수동'}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-900">
          {new Date(run.started_at).toLocaleString('ko-KR')}
        </div>
        {run.completed_at && (
          <div className="text-xs text-gray-500">
            완료: {new Date(run.completed_at).toLocaleString('ko-KR', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
          {statusIcon} {statusText}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {run.completed_batches} / {run.total_batches}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm">
        <span className="text-green-600 font-medium">{run.successful_urls}</span> /
        <span className="text-gray-900 ml-1">{run.total_urls_crawled}</span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm">
        <div>
          {run.total_announcements} /
          <span className="text-blue-600 font-medium ml-1">{run.relevant_announcements}</span> /
          <span className="text-purple-600 font-medium ml-1">{run.ai_verified_announcements}</span>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <span className="text-sm font-semibold text-gray-900 mr-2">{successRate}%</span>
          <div className="w-16 bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full"
              style={{ width: `${successRate}%` }}
            />
          </div>
        </div>
      </td>
    </tr>
  );
}
