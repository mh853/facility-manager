# 지자체별 크롤링 모니터링 UI 설계

## 개요

지자체(지역)별로 크롤링 성공/실패를 한눈에 파악할 수 있는 모니터링 UI

## 주요 기능

### 1. 지자체별 통계 테이블
- 지역명, URL 수, 성공/실패 횟수, 성공률
- 건강 상태 (정상/주의/위험)
- 공고 수 (전체/관련/AI검증)
- 마지막 크롤링 시간

### 2. 시각화
- 지역별 성공률 막대 그래프
- 건강 상태별 파이 차트
- 문제 지역 알림

### 3. 상세 보기
- 지역 클릭 시 해당 지역의 URL 목록
- URL별 상세 통계

## API 엔드포인트

### GET /api/subsidy-crawler/stats/by-region

**쿼리 파라미터**:
- `period`: 통계 기간 (기본 30일)
- `run_id`: 특정 실행의 지역별 통계 (선택)

**응답 구조**:
```typescript
{
  success: true,
  data: {
    regions: [
      {
        region_name: "서울특별시",
        region_code: "11000",
        total_urls: 15,
        successful_crawls: 42,  // 최근 30일간
        failed_crawls: 3,
        success_rate: 93.33,
        total_announcements: 125,
        relevant_announcements: 45,
        ai_verified_announcements: 38,
        avg_response_time_ms: 1250,
        last_crawled_at: "2025-12-23T12:00:00Z",
        health_status: "healthy"  // healthy | warning | critical
      },
      // ... 다른 지역들
    ],
    summary: {
      total_regions: 17,
      healthy_regions: 14,
      warning_regions: 2,
      critical_regions: 1,
      total_urls: 230,
      total_successful: 2100,
      total_failed: 150,
      overall_success_rate: 93.33
    },
    period_days: 30
  }
}
```

## UI 컴포넌트 구조

### 페이지: /admin/subsidy/regional-stats

```
┌─────────────────────────────────────────────────────┐
│ 📊 지자체별 크롤링 통계                                │
│                                                     │
│ ┌─────────────────────────────────────────────┐   │
│ │ 요약 카드                                     │   │
│ │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐        │   │
│ │ │ 17개 │ │ 14개 │ │ 2개  │ │ 1개  │        │   │
│ │ │ 지역  │ │ 정상 │ │ 주의 │ │ 위험 │        │   │
│ │ └──────┘ └──────┘ └──────┘ └──────┘        │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ ┌─────────────────────────────────────────────┐   │
│ │ 문제 지역 알림                                │   │
│ │ ⚠️ 대구광역시: 성공률 45% (주의)             │   │
│ │ 🚨 제주특별자치도: 성공률 25% (위험)          │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ ┌─────────────────────────────────────────────┐   │
│ │ 지역별 상세 통계 테이블                       │   │
│ │                                               │   │
│ │ 지역명 | URL수 | 성공률 | 공고수 | 상태     │   │
│ │ ────────────────────────────────────────    │   │
│ │ 제주특별자치도 | 8 | 25% | 12 | 🚨 위험    │   │
│ │ 대구광역시 | 12 | 45% | 28 | ⚠️ 주의       │   │
│ │ 부산광역시 | 15 | 87% | 45 | ✅ 정상       │   │
│ │ 서울특별시 | 15 | 93% | 125 | ✅ 정상      │   │
│ │ ...                                          │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ ┌─────────────────────────────────────────────┐   │
│ │ 성공률 시각화 (막대 그래프)                   │   │
│ │                                               │   │
│ │ 서울특별시 ████████████████████ 93%          │   │
│ │ 부산광역시 ████████████████ 87%              │   │
│ │ 대구광역시 ████████ 45%                      │   │
│ │ 제주특별자치도 ████ 25%                      │   │
│ └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## UI 컴포넌트 코드 구조

### RegionalStatsPage.tsx
```typescript
'use client';

import { useState, useEffect } from 'react';

interface RegionalStats {
  region_name: string;
  region_code: string | null;
  total_urls: number;
  successful_crawls: number;
  failed_crawls: number;
  success_rate: number;
  total_announcements: number;
  relevant_announcements: number;
  ai_verified_announcements: number;
  avg_response_time_ms: number | null;
  last_crawled_at: string | null;
  health_status: 'healthy' | 'warning' | 'critical';
}

interface RegionalStatsData {
  regions: RegionalStats[];
  summary: {
    total_regions: number;
    healthy_regions: number;
    warning_regions: number;
    critical_regions: number;
    total_urls: number;
    total_successful: number;
    total_failed: number;
    overall_success_rate: number;
  };
  period_days: number;
}

export default function RegionalStatsPage() {
  const [data, setData] = useState<RegionalStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);

  useEffect(() => {
    loadStats();
  }, [period]);

  const loadStats = async () => {
    setLoading(true);
    const response = await fetch(`/api/subsidy-crawler/stats/by-region?period=${period}`);
    const result = await response.json();
    if (result.success) {
      setData(result.data);
    }
    setLoading(false);
  };

  if (loading) return <div>로딩 중...</div>;
  if (!data) return <div>데이터를 불러올 수 없습니다.</div>;

  // 문제 지역 필터링
  const problemRegions = data.regions.filter(
    r => r.health_status === 'warning' || r.health_status === 'critical'
  );

  return (
    <div className="p-6 space-y-6">
      {/* 제목 */}
      <h1 className="text-2xl font-bold">📊 지자체별 크롤링 통계</h1>

      {/* 기간 선택 */}
      <div className="flex gap-2">
        <button
          onClick={() => setPeriod(7)}
          className={period === 7 ? 'btn-primary' : 'btn-secondary'}
        >
          최근 7일
        </button>
        <button
          onClick={() => setPeriod(30)}
          className={period === 30 ? 'btn-primary' : 'btn-secondary'}
        >
          최근 30일
        </button>
        <button
          onClick={() => setPeriod(90)}
          className={period === 90 ? 'btn-primary' : 'btn-secondary'}
        >
          최근 90일
        </button>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard
          label="전체 지역"
          value={data.summary.total_regions}
          icon="🗺️"
        />
        <SummaryCard
          label="정상 지역"
          value={data.summary.healthy_regions}
          icon="✅"
          color="green"
        />
        <SummaryCard
          label="주의 지역"
          value={data.summary.warning_regions}
          icon="⚠️"
          color="yellow"
        />
        <SummaryCard
          label="위험 지역"
          value={data.summary.critical_regions}
          icon="🚨"
          color="red"
        />
      </div>

      {/* 문제 지역 알림 */}
      {problemRegions.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-semibold mb-2">⚠️ 주의가 필요한 지역</h3>
          <ul className="space-y-1">
            {problemRegions.map(region => (
              <li key={region.region_name}>
                {region.health_status === 'critical' ? '🚨' : '⚠️'}{' '}
                <strong>{region.region_name}</strong>: 성공률{' '}
                {region.success_rate.toFixed(1)}% ({region.successful_crawls}/
                {region.successful_crawls + region.failed_crawls})
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 지역별 통계 테이블 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                지역명
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                URL 수
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                성공/실패
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                성공률
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                공고 (전체/관련/AI)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                평균 응답시간
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                상태
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.regions.map(region => (
              <RegionalStatsRow key={region.region_name} region={region} />
            ))}
          </tbody>
        </table>
      </div>

      {/* 성공률 시각화 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">지역별 성공률</h3>
        <div className="space-y-3">
          {data.regions.map(region => (
            <div key={region.region_name}>
              <div className="flex justify-between text-sm mb-1">
                <span>{region.region_name}</span>
                <span className="font-semibold">{region.success_rate.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    region.health_status === 'healthy'
                      ? 'bg-green-500'
                      : region.health_status === 'warning'
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${region.success_rate}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 하위 컴포넌트들
function SummaryCard({ label, value, icon, color }: {
  label: string;
  value: number;
  icon: string;
  color?: 'green' | 'yellow' | 'red';
}) {
  const bgColor = color === 'green' ? 'bg-green-50' :
                  color === 'yellow' ? 'bg-yellow-50' :
                  color === 'red' ? 'bg-red-50' : 'bg-gray-50';

  return (
    <div className={`${bgColor} rounded-lg p-4`}>
      <div className="text-3xl mb-2">{icon}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-gray-600">{label}</div>
    </div>
  );
}

function RegionalStatsRow({ region }: { region: RegionalStats }) {
  const statusIcon = region.health_status === 'healthy' ? '✅' :
                     region.health_status === 'warning' ? '⚠️' : '🚨';

  const statusColor = region.health_status === 'healthy' ? 'text-green-600' :
                      region.health_status === 'warning' ? 'text-yellow-600' : 'text-red-600';

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="font-medium text-gray-900">{region.region_name}</div>
        {region.region_code && (
          <div className="text-xs text-gray-500">{region.region_code}</div>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {region.total_urls}개
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm">
        <span className="text-green-600">{region.successful_crawls}</span> /{' '}
        <span className="text-red-600">{region.failed_crawls}</span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-semibold">{region.success_rate.toFixed(1)}%</div>
        <div className="w-20 bg-gray-200 rounded-full h-1 mt-1">
          <div
            className={`h-1 rounded-full ${
              region.health_status === 'healthy' ? 'bg-green-500' :
              region.health_status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${region.success_rate}%` }}
          />
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {region.total_announcements} /{' '}
        <span className="text-blue-600">{region.relevant_announcements}</span> /{' '}
        <span className="text-purple-600">{region.ai_verified_announcements}</span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {region.avg_response_time_ms ? `${region.avg_response_time_ms}ms` : 'N/A'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`text-lg ${statusColor}`}>{statusIcon}</span>
      </td>
    </tr>
  );
}
```

## 주요 기능 설명

### 1. 건강 상태 분류
```typescript
// 성공률 기준
success_rate >= 80  → ✅ 정상 (healthy)
success_rate >= 50  → ⚠️ 주의 (warning)
success_rate < 50   → 🚨 위험 (critical)
```

### 2. 문제 지역 우선 표시
- 성공률이 낮은 지역부터 정렬
- 문제 지역 알림 섹션에 별도 표시

### 3. 기간별 조회
- 최근 7일 / 30일 / 90일
- 기간별 트렌드 파악 가능

### 4. 상세 정보
- 지역명, 지역코드
- URL 수 (해당 지역의 크롤링 대상 URL 개수)
- 성공/실패 횟수 (기간 내)
- 성공률 (백분율 + 시각화)
- 공고 수 (전체/관련/AI검증)
- 평균 응답시간

## 다음 단계

1. **API 테스트**: 지역별 통계 API 동작 확인
2. **UI 구현**: React 컴포넌트 작성
3. **네비게이션 추가**: 관리자 메뉴에 지역별 통계 링크
4. **상세 페이지**: 지역 클릭 시 해당 지역의 URL 목록 및 상세 통계

## 기대 효과

✅ **한눈에 파악**: 어느 지역이 문제인지 즉시 확인
✅ **문제 지역 집중**: 성공률 낮은 지역 우선 처리
✅ **트렌드 분석**: 기간별 지역 성능 변화 추적
✅ **효율적 관리**: 지역별로 URL 추가/제거 결정
