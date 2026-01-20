'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AdminLayout from '@/components/ui/AdminLayout';
import AnnouncementsSection from './AnnouncementsSection';

// ============================================================
// 크롤링 실행 상세 뷰
// ============================================================
// 목적: 특정 크롤링 실행의 배치별 상세 결과 및 AI 검증 요약
// 경로: /admin/subsidy/monitoring/[runId]
// ============================================================

interface UrlDetail {
  id: string;
  region_name: string;
  source_url: string;
  is_active: boolean;
}

interface BatchResult {
  id: string;
  batch_number: number;
  urls_in_batch: number;
  successful_urls: number;
  failed_urls: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  total_announcements: number;
  new_announcements: number;
  relevant_announcements: number;
  ai_verified_announcements: number;
  avg_response_time_ms: number | null;
  started_at: string | null;
  completed_at: string | null;
  urls: UrlDetail[];
}

interface RunDetail {
  run: {
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
  };
  batches: BatchResult[];
  ai_verification_summary: {
    total_verified: number;
    ai_relevant: number;
    ai_irrelevant: number;
    keyword_only_match: number;
    ai_only_match: number;
    both_match: number;
    avg_confidence: number;
    total_cost_usd: number;
  };
}

export default function RunDetailPage() {
  const params = useParams();
  const router = useRouter();
  const runId = params.runId as string;

  const [data, setData] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRunDetail();
  }, [runId]);

  const loadRunDetail = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/subsidy-crawler/runs/${runId}`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        console.error('Failed to load run detail:', result.error);
      }
    } catch (error) {
      console.error('Error loading run detail:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="📊 크롤링 실행 상세">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">로딩 중...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!data) {
    return (
      <AdminLayout title="📊 크롤링 실행 상세">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <p className="text-gray-600">실행 기록을 찾을 수 없습니다.</p>
            <button
              onClick={() => router.push('/admin/subsidy/monitoring-dashboard')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              목록으로
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const { run, batches, ai_verification_summary } = data;
  const successRate = run.total_urls_crawled > 0
    ? ((run.successful_urls / run.total_urls_crawled) * 100).toFixed(1)
    : '0.0';

  return (
    <AdminLayout
      title="📊 크롤링 실행 상세"
      subtitle={run.run_id}
      actions={
        <>
          <button
            onClick={loadRunDetail}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            🔄 새로고침
          </button>
          <button
            onClick={() => router.push('/admin/subsidy/monitoring-dashboard')}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            ← 목록으로
          </button>
        </>
      }
    >
      <div className="space-y-6">

      {/* 실행 요약 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">실행 요약</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryItem label="상태" value={getStatusText(run.status)} />
          <SummaryItem label="실행 유형" value={run.trigger_type === 'scheduled' ? '예약' : '수동'} />
          <SummaryItem label="시작 시간" value={new Date(run.started_at).toLocaleString('ko-KR')} />
          <SummaryItem label="완료 시간" value={run.completed_at ? new Date(run.completed_at).toLocaleString('ko-KR') : '진행 중'} />
          <SummaryItem label="배치 진행" value={`${run.completed_batches} / ${run.total_batches}`} />
          <SummaryItem label="URL 크롤링" value={`${run.successful_urls} / ${run.total_urls_crawled}`} />
          <SummaryItem label="성공률" value={`${successRate}%`} />
          <SummaryItem label="전체 공고" value={run.total_announcements.toString()} />
        </div>
      </div>

      {/* AI 검증 요약 */}
      {ai_verification_summary.total_verified > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">🤖 AI 검증 요약</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryItem label="총 검증" value={ai_verification_summary.total_verified.toString()} />
            <SummaryItem label="AI 관련" value={ai_verification_summary.ai_relevant.toString()} color="green" />
            <SummaryItem label="AI 무관" value={ai_verification_summary.ai_irrelevant.toString()} color="red" />
            <SummaryItem label="일치" value={ai_verification_summary.both_match.toString()} color="blue" />
            <SummaryItem label="키워드만" value={ai_verification_summary.keyword_only_match.toString()} color="yellow" />
            <SummaryItem label="AI만" value={ai_verification_summary.ai_only_match.toString()} color="purple" />
            <SummaryItem label="평균 신뢰도" value={`${(ai_verification_summary.avg_confidence * 100).toFixed(1)}%`} />
            <SummaryItem label="총 비용" value={`$${ai_verification_summary.total_cost_usd.toFixed(4)}`} />
          </div>
        </div>
      )}

      {/* 배치 상세 결과 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">배치별 상세 결과</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  배치 #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  URL (성공/전체)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  공고 (전체/신규)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  관련도 (키워드/AI)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  평균 응답시간
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  실행 시간
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {batches.map(batch => (
                <BatchRow key={batch.id} batch={batch} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 발견된 공고 목록 */}
      <AnnouncementsSection runId={runId} />
      </div>
    </AdminLayout>
  );
}

// 상태 텍스트 변환
function getStatusText(status: string): string {
  switch (status) {
    case 'completed': return '✅ 완료';
    case 'running': return '🔄 실행 중';
    case 'failed': return '❌ 실패';
    case 'partial': return '⚠️ 부분 완료';
    default: return status;
  }
}

// 요약 아이템 컴포넌트
function SummaryItem({ label, value, color }: {
  label: string;
  value: string;
  color?: 'green' | 'red' | 'blue' | 'yellow' | 'purple';
}) {
  const textColor = color === 'green' ? 'text-green-600' :
                    color === 'red' ? 'text-red-600' :
                    color === 'blue' ? 'text-blue-600' :
                    color === 'yellow' ? 'text-yellow-600' :
                    color === 'purple' ? 'text-purple-600' :
                    'text-gray-900';

  return (
    <div>
      <div className="text-sm text-gray-600">{label}</div>
      <div className={`text-lg font-semibold ${textColor}`}>{value}</div>
    </div>
  );
}

// 배치 행 컴포넌트
function BatchRow({ batch }: { batch: BatchResult }) {
  const [expanded, setExpanded] = useState(false);

  const statusColor = batch.status === 'completed' ? 'text-green-600 bg-green-50' :
                      batch.status === 'running' ? 'text-blue-600 bg-blue-50' :
                      batch.status === 'failed' ? 'text-red-600 bg-red-50' :
                      'text-gray-600 bg-gray-50';

  const statusIcon = batch.status === 'completed' ? '✅' :
                     batch.status === 'running' ? '🔄' :
                     batch.status === 'failed' ? '❌' : '⏳';

  const hasUrls = batch.urls && batch.urls.length > 0;

  return (
    <>
      <tr className="hover:bg-gray-50 transition-colors">
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center gap-2">
            {hasUrls && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-blue-600 hover:text-blue-800 transition-colors"
                aria-label={expanded ? '접기' : '펼치기'}
              >
                {expanded ? '▼' : '▶'}
              </button>
            )}
            <span className="text-lg font-bold text-gray-900">#{batch.batch_number}</span>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
            {statusIcon} {getStatusText(batch.status)}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm">
          <span className="text-green-600 font-medium">{batch.successful_urls}</span> /
          <span className="text-gray-900 ml-1">{batch.urls_in_batch}</span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm">
          {batch.total_announcements} /
          <span className="text-blue-600 font-medium ml-1">{batch.new_announcements}</span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm">
          <span className="text-blue-600 font-medium">{batch.relevant_announcements}</span> /
          <span className="text-purple-600 font-medium ml-1">{batch.ai_verified_announcements}</span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {batch.avg_response_time_ms ? `${batch.avg_response_time_ms}ms` : 'N/A'}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {batch.started_at && batch.completed_at ? (
            <div>
              {new Date(batch.started_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} ~
              {new Date(batch.completed_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          ) : batch.started_at ? (
            <div>진행 중...</div>
          ) : (
            <div>대기 중</div>
          )}
        </td>
      </tr>

      {/* URL 목록 확장 행 */}
      {expanded && hasUrls && (
        <tr>
          <td colSpan={7} className="px-6 py-4 bg-gray-50">
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900 mb-3">📋 크롤링한 URL 목록 ({batch.urls.length}개)</h4>
              <div className="space-y-2">
                {batch.urls.map((url, index) => (
                  <div key={url.id} className="flex items-start gap-3 p-3 bg-white rounded border border-gray-200">
                    <span className="text-sm font-medium text-gray-500 min-w-[30px]">{index + 1}.</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          {url.region_name}
                        </span>
                        {!url.is_active && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                            비활성
                          </span>
                        )}
                      </div>
                      <a
                        href={url.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800 hover:underline break-all"
                      >
                        {url.source_url}
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
