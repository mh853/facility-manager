const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

const templatePath = path.join(process.cwd(), '양식', '☆착공신고서 템플릿.docx');

try {
  console.log('1. 템플릿 파일 읽기...');
  const content = fs.readFileSync(templatePath, 'binary');
  
  console.log('2. ZIP 파싱...');
  const zip = new PizZip(content);
  
  console.log('3. Docxtemplater 초기화...');
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });
  
  console.log('4. 테스트 데이터 준비...');
  const testData = {
    '사업장명': '테스트사업장',
    '주소': '테스트주소',
    '회사연락처': '010-1234-5678',
    '팩스번호': '02-1234-5678',
    '사업자등록번호': '123-45-67890',
    '대표자성명': '홍 길 동',
    '지자체장': '서울시장',
    'year': '2024',
    'month': '11',
    'day': '25',
    '보조금 승인일': '2024.11.01',
    '보조금 승인일+3개월': '2025.02.01',
    '환경부고시가': '5,000,000',
    '보조금 승인액': '4,000,000',
    '자부담': '1,000,000',
    '환경부고시가(부가세포함)': '5,500,000',
    '입금액': '1,100,000',
    '추가비용': '0',
    '추가비용(부가세)': '0',
    '추가비용(포함금액)': '0',
    '네고금액': '0',
    '네고금액(부가세)': '0',
    '네고금액(포함금액)': '0',
    '공급금액': '5,000,000',
    '자부담+추가비용(부가세)+네고금액(부가세)': '1,100,000',
    '입금액+추가비용(포함금액)+네고금액(포함금액)': '1,100,000',
    '게이트웨이': '1',
    'VPN': '유선',
    '배출CT': '1',
    '방지CT': '1',
    '차압계': '1',
    '온도계': '1',
    'PH계': '0',
    '방지시설명': '습식집진기 (10CMM)'
  };
  
  console.log('5. 템플릿 렌더링...');
  doc.render(testData);
  
  console.log('6. 문서 생성...');
  const buffer = doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE'
  });
  
  console.log('✅ 성공! 테스트 파일 생성됨');
  fs.writeFileSync('/tmp/test_output.docx', buffer);
  console.log('테스트 파일 위치: /tmp/test_output.docx');
  
} catch (error) {
  console.error('❌ 에러 발생:');
  console.error('메시지:', error.message);
  console.error('타입:', error.name);
  
  if (error.properties && error.properties.errors) {
    console.error('\n상세 에러 목록:');
    error.properties.errors.slice(0, 10).forEach((err, index) => {
      console.error(`\n에러 #${index + 1}:`);
      console.error('  메시지:', err.message);
      if (err.properties) {
        console.error('  상세:', JSON.stringify(err.properties, null, 2));
      }
    });
    console.error(`\n... 그 외 ${error.properties.errors.length - 10}개 에러`);
  }
}
