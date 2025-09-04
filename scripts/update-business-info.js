// scripts/update-business-info.js - 엑셀 데이터로 business_info 테이블 업데이트
const XLSX = require('xlsx');
const path = require('path');

async function updateBusinessInfo() {
  console.log('🔄 business_info 업데이트 시작...');
  
  try {
    // 1. 엑셀 파일 읽기
    const filePath = path.join(__dirname, '../사업장 정보DB.xlsx');
    const workbook = XLSX.readFile(filePath);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    console.log(`📊 엑셀 데이터: ${jsonData.length - 1}개 사업장 (헤더 제외)`);
    
    if (jsonData.length < 2) {
      throw new Error('엑셀 파일에 유효한 데이터가 없습니다');
    }
    
    // 2. 헤더 매핑
    const headers = jsonData[0];
    const headerMap = {};
    headers.forEach((header, index) => {
      headerMap[header] = index;
    });
    
    console.log('📋 헤더 매핑 완료:', Object.keys(headerMap));
    
    // 3. 엑셀 데이터 파싱
    const excelBusinesses = jsonData.slice(1).map((row, index) => {
      try {
        return {
          사업장명: row[headerMap['사업장명']] || '',
          주소: row[headerMap['주소']] || '',
          담당자명: row[headerMap['사업장담당자']] || '',
          담당자연락처: row[headerMap['연락처']] || '',
          담당자직급: row[headerMap['담당자직급']] || '',
          대표자: row[headerMap['대표자명']] || '',
          사업자등록번호: row[headerMap['사업자등록번호']] || '',
          업종: row[headerMap['업종']] || '',
          사업장연락처: row[headerMap['사업장연락처']] || row[headerMap['연락처']] || '',
          PH센서: parseInt(row[headerMap['PH센서']] || '0') || 0,
          차압계: parseInt(row[headerMap['차압계']] || '0') || 0,
          온도계: parseInt(row[headerMap['온도계']] || '0') || 0,
          배출전류계: parseInt(row[headerMap['배출전류계']] || '0') || 0,
          송풍전류계: parseInt(row[headerMap['송풍전류계']] || '0') || 0,
          펌프전류계: parseInt(row[headerMap['펌프전류계']] || '0') || 0,
          게이트웨이: parseInt(row[headerMap['게이트웨이']] || '0') || 0,
          VPN유선: parseInt(row[headerMap['VPN(유선)']] || '0') || 0,
          VPN무선: parseInt(row[headerMap['VPN(무선)']] || '0') || 0,
          복수굴뚝: parseInt(row[headerMap['복수굴뚝(설치비)']] || '0') || 0,
          네고: row[headerMap['네고']] || '',
          originalIndex: index + 1
        };
      } catch (error) {
        console.warn(`⚠️ 행 ${index + 2} 파싱 오류:`, error);
        return null;
      }
    }).filter(Boolean);
    
    console.log(`✅ 엑셀 데이터 파싱 완료: ${excelBusinesses.length}개 사업장`);
    
    // 4. 업데이트 API 호출
    const updateResponse = await fetch('http://localhost:3005/api/business-info-update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        excelData: excelBusinesses,
        preview: false // 실제 업데이트 실행
      })
    });
    
    if (!updateResponse.ok) {
      throw new Error(`업데이트 API 호출 실패: ${updateResponse.status}`);
    }
    
    const result = await updateResponse.json();
    
    if (result.success) {
      console.log('🎉 업데이트 완료!');
      console.log(`📊 결과 요약:`, result.summary);
      console.log(`✅ 성공: ${result.summary.updated}개`);
      console.log(`➕ 새로 추가: ${result.summary.inserted}개`);
      console.log(`❌ 실패: ${result.summary.failed}개`);
      
      if (result.summary.failed > 0) {
        console.log('❌ 실패한 사업장들:', result.failedItems.map(item => item.사업장명));
      }
    } else {
      console.error('❌ 업데이트 실패:', result.message);
    }
    
  } catch (error) {
    console.error('❌ 업데이트 프로세스 실패:', error);
  }
}

// 미리보기 모드로 실행
async function previewUpdate() {
  console.log('👀 업데이트 미리보기...');
  
  try {
    // 엑셀 파일 읽기 (위와 동일한 로직)
    const filePath = path.join(__dirname, '../사업장 정보DB.xlsx');
    const workbook = XLSX.readFile(filePath);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    const headers = jsonData[0];
    const headerMap = {};
    headers.forEach((header, index) => {
      headerMap[header] = index;
    });
    
    const excelBusinesses = jsonData.slice(1).map((row, index) => {
      try {
        return {
          사업장명: row[headerMap['사업장명']] || '',
          주소: row[headerMap['주소']] || '',
          담당자명: row[headerMap['사업장담당자']] || '',
          담당자연락처: row[headerMap['연락처']] || '',
          담당자직급: row[headerMap['담당자직급']] || '',
          대표자: row[headerMap['대표자명']] || '',
          사업자등록번호: row[headerMap['사업자등록번호']] || '',
          업종: row[headerMap['업종']] || '',
          사업장연락처: row[headerMap['사업장연락처']] || row[headerMap['연락처']] || '',
          PH센서: parseInt(row[headerMap['PH센서']] || '0') || 0,
          차압계: parseInt(row[headerMap['차압계']] || '0') || 0,
          온도계: parseInt(row[headerMap['온도계']] || '0') || 0,
          배출전류계: parseInt(row[headerMap['배출전류계']] || '0') || 0,
          송풍전류계: parseInt(row[headerMap['송풍전류계']] || '0') || 0,
          펌프전류계: parseInt(row[headerMap['펌프전류계']] || '0') || 0,
          게이트웨이: parseInt(row[headerMap['게이트웨이']] || '0') || 0,
          VPN유선: parseInt(row[headerMap['VPN(유선)']] || '0') || 0,
          VPN무선: parseInt(row[headerMap['VPN(무선)']] || '0') || 0,
          복수굴뚝: parseInt(row[headerMap['복수굴뚝(설치비)']] || '0') || 0,
          네고: row[headerMap['네고']] || '',
          originalIndex: index + 1
        };
      } catch (error) {
        return null;
      }
    }).filter(Boolean);
    
    // 미리보기 API 호출
    const previewResponse = await fetch('http://localhost:3005/api/business-info-update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        excelData: excelBusinesses,
        preview: true // 미리보기 모드
      })
    });
    
    if (!previewResponse.ok) {
      throw new Error(`미리보기 API 호출 실패: ${previewResponse.status}`);
    }
    
    const result = await previewResponse.json();
    
    if (result.success) {
      console.log('👀 업데이트 미리보기 결과:');
      console.log(`📊 매칭 결과:`, result.preview);
      console.log(`✅ 매칭됨: ${result.preview.matched}개`);
      console.log(`❓ 매칭안됨: ${result.preview.unmatched}개`);
      console.log(`➕ 신규: ${result.preview.newBusinesses}개`);
      
      if (result.preview.unmatched > 0) {
        console.log('❓ 매칭되지 않은 사업장들:', result.unmatchedItems?.slice(0, 5).map(item => item.사업장명));
      }
    } else {
      console.error('❌ 미리보기 실패:', result.message);
    }
    
  } catch (error) {
    console.error('❌ 미리보기 프로세스 실패:', error);
  }
}

// 명령행 인수에 따라 실행 모드 결정
const mode = process.argv[2];

if (mode === 'preview') {
  previewUpdate();
} else if (mode === 'update') {
  updateBusinessInfo();
} else {
  console.log('사용법:');
  console.log('  node scripts/update-business-info.js preview  # 미리보기');
  console.log('  node scripts/update-business-info.js update   # 실제 업데이트');
}