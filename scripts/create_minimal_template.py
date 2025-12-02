#!/usr/bin/env python3
"""
최소 템플릿 생성 - XML 직접 작성 방식
Create minimal template by hand-crafting XML to avoid fragmentation
"""

import zipfile
import os
from datetime import datetime

def create_minimal_template():
    """Create minimal DOCX template with correct XML structure"""

    # Minimal document.xml with placeholders in single text runs
    document_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>

    <!-- Title -->
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r>
        <w:rPr><w:b/><w:sz w:val="36"/></w:rPr>
        <w:t xml:space="preserve">사물인터넷(IoT) 측정기기 부착지원 사업</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r>
        <w:rPr><w:b/><w:sz w:val="36"/></w:rPr>
        <w:t xml:space="preserve">착 공 신 고 서</w:t>
      </w:r>
    </w:p>

    <w:p><w:r><w:t> </w:t></w:r></w:p>

    <!-- Main Table -->
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="9000" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:space="0"/>
          <w:left w:val="single" w:sz="4" w:space="0"/>
          <w:bottom w:val="single" w:sz="4" w:space="0"/>
          <w:right w:val="single" w:sz="4" w:space="0"/>
          <w:insideH w:val="single" w:sz="4" w:space="0"/>
          <w:insideV w:val="single" w:sz="4" w:space="0"/>
        </w:tblBorders>
      </w:tblPr>

      <!-- Row 1: 사업장명 -->
      <w:tr>
        <w:tc>
          <w:tcPr><w:tcW w:w="2000" w:type="dxa"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/></w:pPr>
            <w:r><w:rPr><w:b/></w:rPr><w:t>사 업 장 명</w:t></w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="7000" w:type="dxa"/></w:tcPr>
          <w:p><w:r><w:t xml:space="preserve">{{사업장명}}</w:t></w:r></w:p>
        </w:tc>
      </w:tr>

      <!-- Row 2: 주소 -->
      <w:tr>
        <w:tc>
          <w:p><w:pPr><w:jc w:val="center"/></w:pPr>
            <w:r><w:rPr><w:b/></w:rPr><w:t>사업장소재지</w:t></w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:p><w:r><w:t xml:space="preserve">{{주소}}</w:t></w:r></w:p>
          <w:p><w:r><w:t xml:space="preserve">전화: {{회사연락처}}  팩스: {{팩스번호}}</w:t></w:r></w:p>
        </w:tc>
      </w:tr>

      <!-- Row 3: 설치업체명 -->
      <w:tr>
        <w:tc>
          <w:p><w:pPr><w:jc w:val="center"/></w:pPr>
            <w:r><w:rPr><w:b/></w:rPr><w:t>설 치 업 체 명</w:t></w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:p><w:r><w:t>주식회사 블루온</w:t></w:r></w:p>
        </w:tc>
      </w:tr>

      <!-- Row 4: 시공업체소재지 -->
      <w:tr>
        <w:tc>
          <w:p><w:pPr><w:jc w:val="center"/></w:pPr>
            <w:r><w:rPr><w:b/></w:rPr><w:t>시공업체소재지</w:t></w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:p><w:r><w:t>경상북도 고령군 대가야읍 낫질로 285</w:t></w:r></w:p>
          <w:p><w:r><w:t>전화: 1661-5543  팩스: 031-8077-2054</w:t></w:r></w:p>
        </w:tc>
      </w:tr>

      <!-- Row 5: 사업자등록번호 -->
      <w:tr>
        <w:tc>
          <w:p><w:pPr><w:jc w:val="center"/></w:pPr>
            <w:r><w:rPr><w:b/></w:rPr><w:t>사업자등록번호</w:t></w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:p><w:r><w:t xml:space="preserve">사업장: {{사업자등록번호}}</w:t></w:r></w:p>
          <w:p><w:r><w:t>시공업체: 679-86-02827</w:t></w:r></w:p>
        </w:tc>
      </w:tr>

      <!-- Row 6: 부착기간 -->
      <w:tr>
        <w:tc>
          <w:p><w:pPr><w:jc w:val="center"/></w:pPr>
            <w:r><w:rPr><w:b/></w:rPr><w:t>부 착 기 간</w:t></w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:p><w:r><w:t xml:space="preserve">{{보조금 승인일}} 부터 {{보조금 승인일+3개월}} 까지 (3개월)</w:t></w:r></w:p>
        </w:tc>
      </w:tr>

      <!-- Row 7: 총 소요금액 -->
      <w:tr>
        <w:tc>
          <w:p><w:pPr><w:jc w:val="center"/></w:pPr>
            <w:r><w:rPr><w:b/></w:rPr><w:t>총 소 요 금 액</w:t></w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:p><w:r><w:t xml:space="preserve">{{환경부고시가}} 원</w:t></w:r></w:p>
        </w:tc>
      </w:tr>

      <!-- Row 8: 보조금승인액 -->
      <w:tr>
        <w:tc>
          <w:p><w:pPr><w:jc w:val="center"/></w:pPr>
            <w:r><w:rPr><w:b/></w:rPr><w:t>보조금승인액</w:t></w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:p><w:r><w:t xml:space="preserve">{{보조금 승인액}} 원</w:t></w:r></w:p>
        </w:tc>
      </w:tr>

      <!-- Row 9: 자체부담액 -->
      <w:tr>
        <w:tc>
          <w:p><w:pPr><w:jc w:val="center"/></w:pPr>
            <w:r><w:rPr><w:b/></w:rPr><w:t>자 체 부 담 액</w:t></w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:p><w:r><w:t xml:space="preserve">{{자부담}} 원</w:t></w:r></w:p>
        </w:tc>
      </w:tr>

      <!-- Row 10: 입금액 -->
      <w:tr>
        <w:tc>
          <w:p><w:pPr><w:jc w:val="center"/></w:pPr>
            <w:r><w:rPr><w:b/></w:rPr><w:t>입 금 액</w:t></w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:p><w:r><w:t xml:space="preserve">{{입금액}} 원 (부가세 포함)</w:t></w:r></w:p>
        </w:tc>
      </w:tr>

      <!-- Row 11: 설치 품목 -->
      <w:tr>
        <w:tc>
          <w:p><w:pPr><w:jc w:val="center"/></w:pPr>
            <w:r><w:rPr><w:b/></w:rPr><w:t>설 치 품 목</w:t></w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:p><w:r><w:t xml:space="preserve">게이트웨이: {{게이트웨이}}대, VPN: {{VPN}}, 배출CT: {{배출CT}}개, 방지CT: {{방지CT}}개, 차압계: {{차압계}}개, 온도계: {{온도계}}개, PH계: {{PH계}}개</w:t></w:r></w:p>
          <w:p><w:r><w:t xml:space="preserve">방지시설: {{방지시설명}}</w:t></w:r></w:p>
        </w:tc>
      </w:tr>

    </w:tbl>

    <w:p><w:r><w:t> </w:t></w:r></w:p>

    <!-- Declaration -->
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:t xml:space="preserve">소규모 사업장 사물인터넷(IoT) 측정기기 부착지원 사업에</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:t xml:space="preserve">대하여 착공신고서를 제출합니다.</w:t></w:r>
    </w:p>

    <w:p><w:r><w:t> </w:t></w:r></w:p>

    <!-- Date -->
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:t xml:space="preserve">{{year}} 년  {{month}} 월  {{day}} 일</w:t></w:r>
    </w:p>

    <w:p><w:r><w:t> </w:t></w:r></w:p>

    <!-- Signature -->
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:t xml:space="preserve">신청인(대표자)  {{사업장명}}  {{대표자성명}}  (인)</w:t></w:r>
    </w:p>

    <w:p><w:r><w:t> </w:t></w:r></w:p>

    <!-- Recipient -->
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">{{지자체장}}  귀하</w:t></w:r>
    </w:p>

    <w:p><w:r><w:t> </w:t></w:r></w:p>

    <!-- Documents Table -->
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="9000" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:space="0"/>
          <w:left w:val="single" w:sz="4" w:space="0"/>
          <w:bottom w:val="single" w:sz="4" w:space="0"/>
          <w:right w:val="single" w:sz="4" w:space="0"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        <w:tc>
          <w:p><w:pPr><w:jc w:val="center"/></w:pPr>
            <w:r><w:rPr><w:b/></w:rPr><w:t>구 비 서 류</w:t></w:r>
          </w:p>
          <w:p><w:r><w:t>1. 대기배출시설 설치 허가(신고)증 사본 1부.</w:t></w:r></w:p>
          <w:p><w:r><w:t>2. 계약서(사본) 1부.</w:t></w:r></w:p>
          <w:p><w:r><w:t>3. 자부담금 입금 확인증 1부.</w:t></w:r></w:p>
          <w:p><w:r><w:t>4. 계약이행보증보험 1부.</w:t></w:r></w:p>
          <w:p><w:r><w:t>5. 개선계획서(최종, 보완사항 포함) 1부.</w:t></w:r></w:p>
        </w:tc>
      </w:tr>
    </w:tbl>

  </w:body>
</w:document>'''

    # Other required files for a minimal DOCX
    content_types = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>'''

    rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>'''

    # Create DOCX file
    output_path = '양식/☆착공신고서 템플릿_최종.docx'

    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as docx:
        docx.writestr('[Content_Types].xml', content_types)
        docx.writestr('_rels/.rels', rels)
        docx.writestr('word/document.xml', document_xml)

    print(f'✅ 최소 템플릿 생성 완료: {output_path}')
    print('\n📋 포함된 플레이스홀더:')
    import re
    placeholders = re.findall(r'\{\{([^}]+)\}\}', document_xml)
    for i, p in enumerate(set(placeholders), 1):
        print(f'  {i}. {{{{{p}}}}}')

if __name__ == '__main__':
    create_minimal_template()
