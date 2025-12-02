#!/usr/bin/env python3
"""
템플릿에서 XML 주석 제거
Remove XML comments from template
"""

import zipfile
import re
import os

def remove_comments_from_template(input_path, output_path):
    """Remove XML comments from DOCX template"""

    print(f'📖 읽는 중: {input_path}')

    # Create temp directory
    temp_dir = 'temp_comment_removal'
    os.makedirs(temp_dir, exist_ok=True)

    try:
        # Extract DOCX
        with zipfile.ZipFile(input_path, 'r') as zip_ref:
            zip_ref.extractall(temp_dir)

        print('✅ DOCX 압축 해제 완료')

        # Read document.xml
        doc_xml_path = os.path.join(temp_dir, 'word', 'document.xml')
        with open(doc_xml_path, 'r', encoding='utf-8') as f:
            xml_content = f.read()

        print('✅ document.xml 읽기 완료')

        # Count comments before
        comments_before = len(re.findall(r'<!--.*?-->', xml_content, re.DOTALL))
        print(f'📝 주석 발견: {comments_before}개')

        # Remove XML comments
        xml_without_comments = re.sub(r'<!--.*?-->', '', xml_content, flags=re.DOTALL)

        # Count comments after
        comments_after = len(re.findall(r'<!--.*?-->', xml_without_comments, re.DOTALL))
        print(f'✅ 주석 제거 후: {comments_after}개')

        # Write fixed XML
        with open(doc_xml_path, 'w', encoding='utf-8') as f:
            f.write(xml_without_comments)

        print('✅ document.xml 수정 완료')

        # Recreate DOCX
        with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zip_ref:
            for root, dirs, files in os.walk(temp_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, temp_dir)
                    zip_ref.write(file_path, arcname)

        print(f'✅ 수정된 파일 저장: {output_path}')

    finally:
        # Cleanup
        import shutil
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
        print('✅ 임시 파일 정리 완료')

if __name__ == '__main__':
    input_file = '양식/☆착공신고서 템플릿_최종.docx'
    output_file = '양식/☆착공신고서 템플릿_최종_주석제거.docx'

    if not os.path.exists(input_file):
        print(f'❌ 입력 파일을 찾을 수 없습니다: {input_file}')
        exit(1)

    print('🔧 XML 주석 제거 시작...\n')
    remove_comments_from_template(input_file, output_file)
    print('\n🎉 완료!')
