/**
 * 테스트 사진 데이터 삭제 스크립트
 * 로컬 개발 환경에서만 사용
 *
 * 사용법:
 * npx ts-node scripts/delete-test-photos.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function deleteTestPhotos() {
  console.log('🗑️  테스트 사진 삭제 시작...')

  try {
    // 1. 현재 사진 개수 확인
    const { count: beforeCount } = await supabase
      .from('uploaded_files')
      .select('*', { count: 'exact', head: true })

    console.log(`📊 현재 총 사진 개수: ${beforeCount}개`)

    // 2. 특정 사업장의 사진만 삭제
    const businessId = '79b4e0e2-e6b1-40fa-894e-6670295fcf4b' // 안계농협 미곡종합처리장(비안면)

    // 사업장 이름 조회
    const { data: business } = await supabase
      .from('businesses')
      .select('business_name')
      .eq('id', businessId)
      .single()

    const businessName = business?.business_name || businessId

    const { data: filesToDelete, error: fetchError } = await supabase
      .from('uploaded_files')
      .select('*')
      .eq('business_id', businessId)

    if (fetchError) {
      throw fetchError
    }

    console.log(`🔍 "${businessName}" 사진: ${filesToDelete?.length || 0}개`)

    if (!filesToDelete || filesToDelete.length === 0) {
      console.log('✅ 삭제할 사진이 없습니다.')
      return
    }

    // 3. Storage에서 파일 삭제
    for (const file of filesToDelete) {
      const filePath = file.file_path

      const { error: storageError } = await supabase
        .storage
        .from('facility-files')
        .remove([filePath])

      if (storageError) {
        console.warn(`⚠️  Storage 삭제 실패: ${filePath}`, storageError.message)
      } else {
        console.log(`🗑️  Storage 삭제: ${filePath}`)
      }
    }

    // 4. 데이터베이스에서 레코드 삭제
    const { error: deleteError } = await supabase
      .from('uploaded_files')
      .delete()
      .eq('business_id', businessId)

    if (deleteError) {
      throw deleteError
    }

    // 5. 삭제 후 사진 개수 확인
    const { count: afterCount } = await supabase
      .from('uploaded_files')
      .select('*', { count: 'exact', head: true })

    console.log(`\n✅ 삭제 완료!`)
    console.log(`📊 삭제 전: ${beforeCount}개`)
    console.log(`📊 삭제 후: ${afterCount}개`)
    console.log(`🗑️  삭제됨: ${(beforeCount || 0) - (afterCount || 0)}개`)

  } catch (error) {
    console.error('❌ 삭제 중 오류 발생:', error)
    process.exit(1)
  }
}

// 실행
deleteTestPhotos()
