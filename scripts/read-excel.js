// scripts/read-excel.js - 엑셀 파일 읽기 및 분석
const XLSX = require('xlsx');
const path = require('path');

// 엑셀 파일 읽기
const filePath = path.join(__dirname, '../사업장 정보DB.xlsx');
console.log('📊 엑셀 파일 읽기 시작:', filePath);

try {
  const workbook = XLSX.readFile(filePath);
  console.log('📋 시트 목록:', workbook.SheetNames);
  
  // 첫 번째 시트 읽기
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  // JSON으로 변환
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  console.log('📊 데이터 개수:', jsonData.length);
  console.log('📋 헤더 (첫 번째 행):', jsonData[0]);
  console.log('📝 첫 번째 데이터 샘플:', jsonData[1]);
  console.log('📝 두 번째 데이터 샘플:', jsonData[2]);
  
  // 헤더 분석
  if (jsonData.length > 0) {
    const headers = jsonData[0];
    console.log('\n🔍 컬럼 분석:');
    headers.forEach((header, index) => {
      console.log(`  ${index + 1}. ${header}`);
    });
  }
  
  console.log('\n✅ 엑셀 파일 분석 완료');
  
} catch (error) {
  console.error('❌ 엑셀 파일 읽기 실패:', error);
}