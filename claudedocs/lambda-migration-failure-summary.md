# AWS Lambda 마이그레이션 실패 요약

**작성일**: 2026-01-27
**목적**: Vercel 60초 타임아웃 문제 해결을 위한 AWS Lambda (15분) 마이그레이션 시도
**결과**: ❌ 실패 - 시스템 라이브러리 부족으로 Chromium 실행 불가

---

## 📋 시도 내역

### 1차 시도: Playwright + @sparticuz/chromium
```javascript
const { chromium } = require('playwright-core');
const chromiumPack = require('@sparticuz/chromium');

const browser = await chromium.launch({
  args: chromiumPack.args,
  executablePath: await chromiumPack.executablePath(),
  headless: true
});
```

**결과**:
```
browserType.launch: Target page, context or browser has been closed
Browser logs: /tmp/chromium: error while loading shared libraries:
libnss3.so: cannot open shared object file: No such file or directory
```

### 2차 시도: Puppeteer + @sparticuz/chromium
```javascript
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

const browser = await puppeteer.launch({
  args: chromium.args,
  defaultViewport: chromium.defaultViewport,
  executablePath: await chromium.executablePath(),
  headless: chromium.headless
});
```

**결과**: 동일한 `libnss3.so` 오류

### 3차 시도: Lambda Layer 변경
- `arn:aws:lambda:us-east-1:764866452798:layer:chrome-aws-lambda:31` (구버전)
- `arn:aws:lambda:us-east-1:764866452798:layer:chrome-aws-lambda:46` (접근 권한 없음)
- `arn:aws:lambda:us-east-1:764866452798:layer:chromium:131` (접근 권한 없음)

**결과**: Layer 유무와 관계없이 동일한 오류

### 4차 시도: executablePath 직접 지정
```javascript
executablePath: '/opt/chromium'  // Lambda Layer 경로
```

**결과**: `/opt/chromium` 디렉토리 존재하지 않음

### 5차 시도: Lambda Layer 제거
Layer 없이 패키지 자체 Chromium만 사용

**결과**: 동일한 `libnss3.so` 오류

---

## 🔍 근본 원인 분석

### 문제
AWS Lambda의 Amazon Linux 2 환경에는 Chromium 실행에 필요한 **GUI 관련 시스템 라이브러리**가 설치되어 있지 않음

### 부족한 라이브러리
```
libnss3.so          # Network Security Services
libX11.so           # X11 display server
libXcomposite.so    # X11 composite extension
libXcursor.so       # X cursor management library
libXdamage.so       # X Damage extension
libXext.so          # X11 extensions
libXfixes.so        # X11 fixes extension
libXi.so            # X11 Input extension
libXrender.so       # X Rendering Extension
libXtst.so          # X11 testing extension
libxcb.so           # X protocol C-language Binding
libgbm.so           # Generic Buffer Management
libdrm.so           # Direct Rendering Manager
libasound.so        # ALSA sound library
libatk-1.0.so       # ATK accessibility toolkit
libcups.so          # Common Unix Printing System
libpango-1.0.so     # Pango text layout engine
libcairo.so         # Cairo 2D graphics library
libgdk-3.so         # GTK+ GDK library
libgtk-3.so         # GTK+ toolkit
```

### 왜 @sparticuz/chromium도 안 되는가?

`@sparticuz/chromium` 패키지는:
- Chromium 바이너리 자체는 포함 (압축된 형태)
- 하지만 **시스템 레벨 라이브러리는 포함하지 않음**
- Lambda 환경의 시스템 라이브러리에 의존

Lambda Layer도:
- 패키지 의존성만 포함
- OS 레벨 시스템 라이브러리는 포함하지 않음

---

## 🛠️ 해결 방법 (구현하지 않음)

### Option 1: Lambda Container Image ⭐ (가장 확실)
```dockerfile
FROM public.ecr.aws/lambda/nodejs:18

# 시스템 라이브러리 설치
RUN yum install -y \
    nss \
    atk \
    cups-libs \
    libdrm \
    libXcomposite \
    libXdamage \
    libXext \
    libXfixes \
    libXrandr \
    mesa-libgbm \
    alsa-lib \
    pango \
    cairo \
    gtk3

# Playwright 및 Chromium 설치
RUN npm install playwright-core @sparticuz/chromium
RUN npx playwright install chromium --with-deps

COPY index.js package.json ./
RUN npm install --production

CMD ["index.handler"]
```

**장점**:
- ✅ 모든 시스템 라이브러리 포함 가능
- ✅ 15분 타임아웃 활용
- ✅ 프리티어 내 무료

**단점**:
- ❌ Docker 빌드/배포 복잡도 높음
- ❌ 이미지 크기 제한 (10GB)
- ❌ 로컬 테스트 환경 구축 필요

### Option 2: EC2 서버
**장점**:
- ✅ 완전한 제어권
- ✅ 타임아웃 제한 없음
- ✅ 시스템 라이브러리 자유롭게 설치

**단점**:
- ❌ 서버 관리 필요
- ❌ 월 $3-10 비용

### Option 3: Railway / DigitalOcean
**장점**:
- ✅ 간단한 배포 (Git push)
- ✅ 타임아웃 제한 없음
- ✅ 관리형 서비스

**단점**:
- ❌ 월 $5-8 비용

---

## 📦 생성된 AWS 리소스

### 정리가 필요한 리소스
1. **Lambda Function**: `subsidy-crawler` (us-east-1)
2. **S3 Bucket**: `subsidy-crawler-lambda-1769159125`
3. **IAM Role**: `lambda-execution-role`
4. **IAM User**: `lambda-deployer` (선택적 삭제)
5. **Function URL**: `https://j4dzqgc4wy7wol2bbeod276tcy0serok.lambda-url.us-east-1.on.aws/`
6. **CloudWatch Log Group**: `/aws/lambda/subsidy-crawler`

### 정리 방법

**자동 정리 (권장)**:
```bash
cd lambda/subsidy-crawler
./cleanup-lambda.sh
```

**수동 정리**:
```bash
# 1. Lambda Function
aws lambda delete-function --function-name subsidy-crawler --region us-east-1

# 2. S3 Bucket
aws s3 rm s3://subsidy-crawler-lambda-1769159125 --recursive --region us-east-1
aws s3 rb s3://subsidy-crawler-lambda-1769159125 --region us-east-1

# 3. IAM Role
aws iam detach-role-policy \
  --role-name lambda-execution-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam delete-role --role-name lambda-execution-role

# 4. CloudWatch Logs
aws logs delete-log-group \
  --log-group-name /aws/lambda/subsidy-crawler \
  --region us-east-1

# 5. IAM User (선택)
aws iam delete-user --user-name lambda-deployer
```

---

## 💰 비용 분석

### 현재까지 발생한 비용
- **Lambda 실행**: $0 (프리티어 내)
- **S3 스토리지**: ~$0.02 (69MB × 30일)
- **CloudWatch Logs**: $0 (최소 사용)
- **총 예상**: ~$0.02

### 정리 후 비용
- 모든 리소스 삭제 시: $0

---

## 📚 학습 내용

### Lambda 환경의 제약사항
1. **기본 환경**: Amazon Linux 2 (최소 패키지만 설치)
2. **GUI 라이브러리**: 기본적으로 없음 (서버 환경)
3. **패키지 크기**: 50MB 직접 업로드, 250MB S3 업로드
4. **Layer**: 패키지 의존성만, OS 라이브러리 아님

### Chromium in Lambda
1. **@sparticuz/chromium**: 바이너리만 포함, 시스템 라이브러리 별도 필요
2. **Lambda Layer**: 애플리케이션 레벨만 지원
3. **Container Image**: OS 레벨 포함 가능 (유일한 해결책)

### 다음 프로젝트 시 고려사항
1. ✅ 환경 제약사항 사전 검증
2. ✅ PoC 테스트로 기술 스택 확인
3. ✅ 복잡도와 비용 트레이드오프 분석
4. ✅ 간단한 웹 크롤링 → Lambda 적합
5. ✅ Chromium 기반 → 전용 서버 또는 Container Image

---

## 🎯 다음 단계

### 권장 방향: Railway 또는 DigitalOcean

**Railway** (가장 간단):
- Git push로 자동 배포
- $5/월
- 설정 30분 소요

**DigitalOcean** (더 많은 제어):
- Ubuntu + Node.js + Chromium
- $6/월
- 설정 60분 소요

**Lambda Container Image** (기술적 도전):
- Docker 지식 필요
- $0/월 (프리티어)
- 설정 2-3시간 소요

### 파일 위치
- 실패 분석: `claudedocs/lambda-migration-failure-summary.md`
- 정리 가이드: `lambda/subsidy-crawler/CLEANUP.md`
- 정리 스크립트: `lambda/subsidy-crawler/cleanup-lambda.sh`
- 마이그레이션 가이드: `docs/aws-lambda-migration-guide.md` (실패 경고 추가됨)

---

## 📞 참고 자료

- [AWS Lambda 실행 환경](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html)
- [Playwright AWS Lambda 이슈](https://github.com/microsoft/playwright/issues/13776)
- [@sparticuz/chromium GitHub](https://github.com/Sparticuz/chromium)
- [Lambda Container Images](https://docs.aws.amazon.com/lambda/latest/dg/images-create.html)
