# AWS Lambda 크롤링 서버 구축 가이드

## 1. AWS Lambda Function 생성

### 1.1 Lambda 함수 설정
```yaml
Runtime: Node.js 18.x
Architecture: x86_64 (Playwright 호환)
Memory: 1024 MB (Chromium 실행 필요)
Timeout: 15분 (최대)
Environment Variables:
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY
  - GEMINI_API_KEY
  - CRAWLER_SECRET
```

### 1.2 Lambda Layer로 Chromium 추가

**Option A: @sparticuz/chromium 사용 (권장)**
```bash
# Layer 생성
npm install @sparticuz/chromium playwright-core
mkdir -p layers/chromium/nodejs/node_modules
cp -r node_modules/@sparticuz layers/chromium/nodejs/node_modules/
cp -r node_modules/playwright-core layers/chromium/nodejs/node_modules/

# ZIP 생성
cd layers/chromium
zip -r chromium-layer.zip nodejs

# AWS에 업로드
aws lambda publish-layer-version \
  --layer-name chromium-playwright \
  --zip-file fileb://chromium-layer.zip \
  --compatible-runtimes nodejs18.x
```

**Option B: AWS Lambda Layer ARN 사용**
```
# Chromium Layer (공개)
arn:aws:lambda:us-east-1:764866452798:layer:chrome-aws-lambda:31
```

### 1.3 Lambda 함수 코드 구조

```typescript
// lambda/crawler/index.ts
import { chromium } from 'playwright-core';
import chromiumPack from '@sparticuz/chromium';

export const handler = async (event: any) => {
  const { urls } = JSON.parse(event.body);

  // Chromium 실행 (Lambda 환경)
  const browser = await chromium.launch({
    args: chromiumPack.args,
    executablePath: await chromiumPack.executablePath(),
    headless: chromiumPack.headless,
  });

  const results = [];

  for (const url of urls) {
    try {
      const page = await browser.newPage();
      await page.goto(url, {
        timeout: 30000,
        waitUntil: 'domcontentloaded'
      });

      // 크롤링 로직 (기존 코드 재사용)
      const content = await page.content();
      results.push({ url, success: true, content });

    } catch (error) {
      results.push({ url, success: false, error: error.message });
    }
  }

  await browser.close();

  return {
    statusCode: 200,
    body: JSON.stringify({ results })
  };
};
```

### 1.4 배포 스크립트

```bash
#!/bin/bash
# deploy-lambda.sh

# 의존성 설치
npm install --production

# ZIP 생성
zip -r function.zip . -x "*.git*" -x "node_modules/@types/*"

# Lambda 업데이트
aws lambda update-function-code \
  --function-name subsidy-crawler \
  --zip-file fileb://function.zip

# 환경 변수 설정
aws lambda update-function-configuration \
  --function-name subsidy-crawler \
  --environment Variables="{
    SUPABASE_URL=$SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY,
    GEMINI_API_KEY=$GEMINI_API_KEY,
    CRAWLER_SECRET=$CRAWLER_SECRET
  }" \
  --timeout 900 \
  --memory-size 1024
```

## 2. API Gateway 설정

### 2.1 REST API 생성
```bash
# API 생성
aws apigateway create-rest-api \
  --name subsidy-crawler-api \
  --description "보조금 크롤링 API"

# Resource 생성
aws apigateway create-resource \
  --rest-api-id <API_ID> \
  --parent-id <ROOT_RESOURCE_ID> \
  --path-part crawl

# POST 메서드 생성
aws apigateway put-method \
  --rest-api-id <API_ID> \
  --resource-id <RESOURCE_ID> \
  --http-method POST \
  --authorization-type NONE
```

### 2.2 Lambda 통합
```bash
# Lambda 권한 부여
aws lambda add-permission \
  --function-name subsidy-crawler \
  --statement-id apigateway-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com

# 통합 설정
aws apigateway put-integration \
  --rest-api-id <API_ID> \
  --resource-id <RESOURCE_ID> \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:<ACCOUNT_ID>:function:subsidy-crawler/invocations
```

### 2.3 API 배포
```bash
aws apigateway create-deployment \
  --rest-api-id <API_ID> \
  --stage-name prod
```

**결과 URL:**
```
https://<API_ID>.execute-api.us-east-1.amazonaws.com/prod/crawl
```

## 3. GitHub Actions 수정

```yaml
# .github/workflows/subsidy-crawler-lambda.yml
- name: 🚀 Lambda 크롤링 실행
  run: |
    RESPONSE=$(curl -s -X POST \
      -H "Content-Type: application/json" \
      -H "x-api-key: ${{ secrets.CRAWLER_SECRET }}" \
      -d "$BODY" \
      "https://<API_ID>.execute-api.us-east-1.amazonaws.com/prod/crawl")
```

## 4. 비용 최적화

### 4.1 Lambda 메모리 최적화
```bash
# 512MB로 줄이기 (Chromium은 가능)
aws lambda update-function-configuration \
  --function-name subsidy-crawler \
  --memory-size 512
```

### 4.2 CloudWatch Logs 보존 기간 설정
```bash
aws logs put-retention-policy \
  --log-group-name /aws/lambda/subsidy-crawler \
  --retention-in-days 7
```

## 5. 모니터링

### 5.1 CloudWatch 대시보드
- Lambda 실행 시간
- 에러 발생률
- 메모리 사용량
- API Gateway 요청 수

### 5.2 알람 설정
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name crawler-errors \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold
```

## 6. 장단점 비교

### ✅ 장점
- **비용**: 프리티어로 $0/월
- **타임아웃**: 15분 (Vercel 60초 vs Lambda 900초)
- **확장성**: 자동 스케일링
- **안정성**: AWS 인프라 사용

### ❌ 단점
- **Cold Start**: 첫 실행 시 3-5초 추가
- **복잡도**: Vercel보다 설정 복잡
- **학습 곡선**: AWS 서비스 이해 필요

## 7. 마이그레이션 체크리스트

- [ ] Lambda 함수 생성
- [ ] Chromium Layer 추가
- [ ] 환경 변수 설정
- [ ] API Gateway 설정
- [ ] 권한 설정 (IAM Role)
- [ ] GitHub Actions 수정
- [ ] 테스트 실행
- [ ] 모니터링 설정
- [ ] Vercel API 비활성화

## 8. 예상 비용 분석

### 8.1 현재 사용량 기준 계산
```
월간 크롤링 요청: 77개 (예상)
평균 실행 시간: 50초 (Chromium 다운로드 포함)
메모리: 1024MB (1GB)

GB-초 계산:
77 요청 × 50초 × 1GB = 3,850 GB-초/월

AWS Lambda 프리티어:
- 1백만 요청/월 (77개는 0.0077%)
- 400,000 GB-초/월 (3,850은 0.96%)
```

### 8.2 결론
**✅ 현재 사용량으로는 완전히 무료** (프리티어 내 운영 가능)

프리티어 초과 시에도:
- 요청당 비용: $0.0000002 (77개 = $0.0000154)
- GB-초 비용: $0.0000166667 (3,850 GB-초 = $0.064)
- **총 예상 비용**: ~$0.07/월 (약 100원)

---

# 별도 크롤링 서버 구축 가이드

## Option 2: 전용 Node.js 서버 (VPS)

### 1. 서버 옵션 비교

| 서비스 | 월 비용 | 메모리 | CPU | 특징 |
|--------|---------|--------|-----|------|
| **DigitalOcean** | $6/월 | 1GB | 1 vCPU | 간단한 설정, 한국어 지원 |
| **Railway** | $5/월~ | 512MB | Shared | Git 연동, 자동 배포 |
| **AWS EC2 t3.micro** | $8/월~ | 1GB | 2 vCPU | AWS 생태계 통합 |
| **Hetzner** | €4.5/월 (~$5) | 2GB | 1 vCPU | 가장 저렴, 유럽 서버 |

**권장**: Railway (가장 간단) 또는 DigitalOcean (안정성)

### 2. Railway 배포 가이드 (가장 쉬움)

#### 2.1 프로젝트 구조
```
crawler-server/
├── package.json
├── server.js
├── crawler.js
└── Dockerfile (선택)
```

#### 2.2 서버 코드 (server.js)
```javascript
const express = require('express');
const { runCrawler } = require('./crawler');

const app = express();
app.use(express.json());

// 크롤링 API 엔드포인트
app.post('/crawl', async (req, res) => {
  const { urls, secret } = req.body;

  // 시크릿 검증
  if (secret !== process.env.CRAWLER_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const results = await runCrawler(urls);
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Crawler server running on port ${PORT}`);
});
```

#### 2.3 크롤러 코드 (crawler.js)
```javascript
const { chromium } = require('playwright');

async function runCrawler(urls) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const results = [];

  for (const url of urls) {
    try {
      const page = await browser.newPage();
      await page.goto(url, {
        timeout: 60000, // ⏱️ 타임아웃 제한 없음
        waitUntil: 'domcontentloaded'
      });

      // 기존 크롤링 로직 재사용
      const content = await page.content();
      results.push({ url, success: true, content });

      await page.close();
    } catch (error) {
      results.push({ url, success: false, error: error.message });
    }
  }

  await browser.close();
  return results;
}

module.exports = { runCrawler };
```

#### 2.4 Railway 배포 단계

**Step 1: Railway 프로젝트 생성**
```bash
# Railway CLI 설치
npm install -g @railway/cli

# 로그인
railway login

# 프로젝트 생성
railway init
```

**Step 2: 환경 변수 설정**
```bash
railway variables set CRAWLER_SECRET=your-secret-here
railway variables set SUPABASE_URL=https://...
railway variables set SUPABASE_SERVICE_ROLE_KEY=...
railway variables set GEMINI_API_KEY=...
```

**Step 3: 배포**
```bash
# Railway에 배포
railway up

# 배포된 URL 확인
railway open
```

**결과 URL:**
```
https://your-project.railway.app/crawl
```

#### 2.5 GitHub Actions 수정
```yaml
# .github/workflows/subsidy-crawler-railway.yml
- name: 🚀 Railway 크롤링 실행
  run: |
    RESPONSE=$(curl -s -X POST \
      -H "Content-Type: application/json" \
      -d "$BODY" \
      "https://your-project.railway.app/crawl")
```

### 3. DigitalOcean 배포 가이드 (더 많은 제어)

#### 3.1 Droplet 생성
```bash
# 1. DigitalOcean 가입 후 Droplet 생성
# OS: Ubuntu 22.04 LTS
# 플랜: Basic ($6/월)
# 지역: 서울 또는 싱가포르
```

#### 3.2 서버 초기 설정
```bash
# SSH 접속
ssh root@your-droplet-ip

# Node.js 설치
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Playwright 의존성 설치
npx playwright install-deps
```

#### 3.3 프로젝트 배포
```bash
# Git 저장소 클론
git clone https://github.com/your-repo/crawler-server.git
cd crawler-server

# 의존성 설치
npm install
npx playwright install chromium

# 환경 변수 설정
cat > .env << EOF
CRAWLER_SECRET=your-secret-here
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
GEMINI_API_KEY=...
PORT=3001
EOF
```

#### 3.4 PM2로 서버 실행 (자동 재시작)
```bash
# PM2 설치
npm install -g pm2

# 서버 시작
pm2 start server.js --name crawler-server

# 부팅 시 자동 시작 설정
pm2 startup
pm2 save
```

#### 3.5 Nginx 리버스 프록시 (선택)
```bash
# Nginx 설치
sudo apt install nginx

# 설정 파일 생성
sudo nano /etc/nginx/sites-available/crawler

# 아래 내용 입력:
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# 설정 활성화
sudo ln -s /etc/nginx/sites-available/crawler /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 4. 전용 서버 장단점

#### ✅ 장점
- **무제한 타임아웃**: 크롤링 시간 제한 없음
- **완전한 제어**: 서버 환경 커스터마이징 가능
- **예측 가능한 비용**: 월 고정 비용 ($5-8)
- **디버깅 용이**: SSH 접속으로 실시간 로그 확인
- **Cold Start 없음**: 항상 실행 중

#### ❌ 단점
- **서버 관리 필요**: 업데이트, 보안 패치 등
- **고정 비용**: 사용 여부와 관계없이 월 비용 발생
- **확장성 제한**: 트래픽 급증 시 수동 스케일링
- **학습 곡선**: 리눅스 서버 관리 지식 필요

---

## 최종 옵션 비교표

| 기준 | Vercel Pro | AWS Lambda | Railway/DO |
|------|------------|------------|------------|
| **월 비용** | $20 (Pro 플랜) | $0 (프리티어) | $5-8 |
| **타임아웃** | 60초 (Hard Limit) | 15분 (900초) | 무제한 |
| **Cold Start** | N/A (항상 활성) | 3-5초 | 0초 (항상 실행) |
| **설정 복잡도** | ⭐ 매우 쉬움 | ⭐⭐⭐ 중간 | ⭐⭐ 쉬움 |
| **확장성** | 자동 | 자동 | 수동 |
| **디버깅** | Vercel 로그 | CloudWatch | SSH + 로그 |
| **유지보수** | Vercel 관리 | AWS 관리 | 직접 관리 |
| **현재 상황** | ❌ 타임아웃 문제 | ✅ 작동 가능 | ✅ 작동 가능 |

## 권장 솔루션

### 🥇 1순위: AWS Lambda + API Gateway
**추천 이유:**
- ✅ **완전히 무료** (프리티어 내 운영)
- ✅ 15분 타임아웃으로 충분
- ✅ 자동 스케일링
- ❌ 설정 복잡도 있지만 한 번만 하면 됨

**적합한 경우:**
- 비용 최소화가 최우선
- AWS 사용 경험이 있거나 배울 의향
- 월 크롤링 횟수가 적음 (100회 미만)

### 🥈 2순위: Railway
**추천 이유:**
- ✅ **가장 쉬운 배포** (Git push만으로 배포)
- ✅ 무제한 타임아웃
- ✅ $5/월로 저렴
- ❌ 월 고정 비용

**적합한 경우:**
- 빠른 구축이 필요
- 서버 관리 경험 없음
- 예측 가능한 비용 선호

### 🥉 3순위: DigitalOcean Droplet
**추천 이유:**
- ✅ 완전한 제어권
- ✅ 다른 용도로도 사용 가능
- ❌ 서버 관리 필요

**적합한 경우:**
- 리눅스 서버 관리 경험 보유
- 향후 확장 계획 (다른 서비스 추가)
- 최대한의 커스터마이징 필요

## 다음 단계

어떤 옵션을 선택하시겠습니까?

1. **AWS Lambda**: 완전 무료, 15분 타임아웃, 설정 90분 소요
2. **Railway**: $5/월, 무제한 타임아웃, 설정 30분 소요
3. **DigitalOcean**: $6/월, 완전한 제어, 설정 60분 소요

선택하신 옵션에 따라 단계별 구현을 도와드리겠습니다.
