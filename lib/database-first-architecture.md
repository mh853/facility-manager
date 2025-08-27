# Database-First 아키텍처 제안

## 🎯 핵심 개념
Google Sheets/Drive에 직접 의존하는 대신, 로컬 데이터베이스를 메인으로 하고 Google API는 동기화 레이어로 사용

## 🏗️ 아키텍처 구조

```
Frontend → Next.js API → SQLite/PostgreSQL → Background Sync → Google APIs
                     ↓
                   즉시 응답 (200ms)
                     ↓
                Background Job → Google Drive/Sheets (3-10초)
```

## 📊 성능 비교

| 방식 | 응답시간 | 안정성 | 데이터 무결성 | 오프라인 지원 |
|------|----------|--------|---------------|---------------|
| **현재 (Direct API)** | 3-10초 | 70% | 보통 | ❌ |
| **제안 (DB-First)** | 200ms | 95% | 높음 | ✅ |

## 🛠️ 구현 방안

### 1. 로컬 데이터베이스 스키마
```sql
-- 사업장 정보
CREATE TABLE businesses (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT,
  google_folder_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  synced_at DATETIME
);

-- 파일 정보
CREATE TABLE uploaded_files (
  id INTEGER PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id),
  filename TEXT NOT NULL,
  file_hash TEXT UNIQUE,
  file_path TEXT,
  google_file_id TEXT,
  sync_status TEXT DEFAULT 'pending', -- pending, synced, failed
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  synced_at DATETIME
);

-- 동기화 작업 큐
CREATE TABLE sync_queue (
  id INTEGER PRIMARY KEY,
  operation_type TEXT, -- upload_file, update_sheet, delete_file
  payload JSON,
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  retry_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME
);
```

### 2. API 흐름 최적화
```typescript
// 즉시 응답 (Fast Path)
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const files = formData.getAll('files') as File[];
  
  // 1. 로컬 저장 (빠름)
  const savedFiles = await saveFilesToLocal(files);
  
  // 2. DB에 기록 (빠름)
  const fileRecords = await insertFileRecords(savedFiles);
  
  // 3. 동기화 작업 큐에 추가 (빠름)
  await addToSyncQueue({
    type: 'upload_files',
    payload: { fileIds: fileRecords.map(f => f.id) }
  });
  
  // 4. 즉시 응답 반환
  return NextResponse.json({
    success: true,
    files: fileRecords,
    message: '파일 업로드 완료 (Google Drive 동기화 중...)'
  });
}
```

### 3. 백그라운드 동기화 워커
```typescript
// Background sync worker
export class GoogleSyncWorker {
  private isRunning = false;
  private syncInterval = 5000; // 5초
  
  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    
    while (this.isRunning) {
      await this.processSyncQueue();
      await new Promise(resolve => setTimeout(resolve, this.syncInterval));
    }
  }
  
  private async processSyncQueue() {
    const pendingTasks = await getSyncTasks(10); // 배치 처리
    
    for (const task of pendingTasks) {
      try {
        await this.processTask(task);
        await markTaskCompleted(task.id);
      } catch (error) {
        await handleTaskError(task, error);
      }
    }
  }
  
  private async processTask(task: SyncTask) {
    switch (task.operation_type) {
      case 'upload_files':
        return await this.syncFilesToDrive(task.payload);
      case 'update_sheet':
        return await this.syncToSheets(task.payload);
      default:
        throw new Error(`Unknown task type: ${task.operation_type}`);
    }
  }
}
```

## 🔧 점진적 마이그레이션 계획

### Phase 1: 하이브리드 모드 (1주)
- 현재 API는 유지하면서 DB 병렬 저장
- 읽기 작업은 DB 우선, 실패시 Google API
- 동기화 상태 모니터링 대시보드 구축

### Phase 2: DB 우선 모드 (1주)  
- 쓰기 작업을 DB 우선으로 전환
- 백그라운드 동기화 워커 활성화
- 실시간 동기화 상태 표시

### Phase 3: 완전 전환 (1주)
- Google API 직접 호출 완전 제거
- 오프라인 모드 지원 활성화
- 성능 최적화 및 모니터링 강화

## 📈 예상 성능 개선

1. **응답시간**: 3-10초 → 200ms (95% 개선)
2. **안정성**: 70% → 95% (25% 개선)  
3. **동시 사용자**: 10명 → 100명 (10배 개선)
4. **오프라인 지원**: 불가능 → 완전 지원
5. **에러 복구**: 수동 → 자동 재시도

## 🎁 추가 혜택

- **캐싱**: 자주 조회되는 데이터 자동 캐시
- **검색**: 빠른 전문 검색 지원
- **백업**: 로컬 데이터 자동 백업
- **분석**: 실시간 사용량 통계
- **확장성**: 다른 클라우드 서비스 연동 가능