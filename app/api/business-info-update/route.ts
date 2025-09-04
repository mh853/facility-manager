// app/api/business-info-update/route.ts - business_info 테이블 업데이트 API
import { NextRequest, NextResponse } from 'next/server';

interface ExcelBusinessData {
  사업장명: string;
  주소: string;
  담당자명: string;
  담당자연락처: string;
  담당자직급: string;
  대표자: string;
  사업자등록번호: string;
  업종: string;
  사업장연락처: string;
  PH센서: number;
  차압계: number;
  온도계: number;
  배출전류계: number;
  송풍전류계: number;
  펌프전류계: number;
  게이트웨이: number;
  VPN유선: number;
  VPN무선: number;
  복수굴뚝: number;
  네고: string;
  originalIndex: number;
}

interface UpdateResult {
  success: boolean;
  summary: {
    total: number;
    matched: number;
    updated: number;
    inserted: number;
    failed: number;
  };
  preview?: {
    matched: number;
    unmatched: number;
    newBusinesses: number;
  };
  failedItems?: any[];
  unmatchedItems?: any[];
}

// 사업장명 매칭 함수 (유사도 계산)
function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  
  // 정확 일치
  if (str1 === str2) return 1.0;
  
  // 공백 제거 후 비교
  const clean1 = str1.replace(/\s+/g, '');
  const clean2 = str2.replace(/\s+/g, '');
  if (clean1 === clean2) return 0.95;
  
  // 괄호 내용 제거 후 비교
  const base1 = str1.replace(/\([^)]*\)/g, '').trim();
  const base2 = str2.replace(/\([^)]*\)/g, '').trim();
  if (base1 === base2) return 0.9;
  
  // 부분 문자열 포함
  if (str1.includes(str2) || str2.includes(str1)) return 0.8;
  
  // Levenshtein 거리 기반 유사도
  const maxLen = Math.max(str1.length, str2.length);
  const distance = levenshteinDistance(str1, str2);
  return Math.max(0, (maxLen - distance) / maxLen);
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}

// 최적 매칭 찾기
function findBestMatch(excelBusiness: ExcelBusinessData, dbBusinesses: any[]): { match: any | null, similarity: number } {
  let bestMatch = null;
  let bestSimilarity = 0;
  
  for (const dbBusiness of dbBusinesses) {
    const similarity = calculateSimilarity(excelBusiness.사업장명, dbBusiness.business_name);
    if (similarity > bestSimilarity && similarity >= 0.8) { // 80% 이상 유사도
      bestMatch = dbBusiness;
      bestSimilarity = similarity;
    }
  }
  
  return { match: bestMatch, similarity: bestSimilarity };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { excelData, preview = false } = body;
    
    if (!excelData || !Array.isArray(excelData)) {
      return NextResponse.json({
        success: false,
        message: '유효한 엑셀 데이터가 필요합니다'
      }, { status: 400 });
    }
    
    console.log(`🔄 [BUSINESS-INFO-UPDATE] ${preview ? '미리보기' : '업데이트'} 시작 - ${excelData.length}개 사업장`);
    
    // 1. 현재 business_info 데이터 조회
    const { supabaseAdmin } = await import('@/lib/supabase');
    
    const { data: existingBusinesses, error: fetchError } = await supabaseAdmin
      .from('business_info')
      .select('*')
      .eq('is_active', true)
      .eq('is_deleted', false);
    
    if (fetchError) {
      throw new Error(`기존 데이터 조회 실패: ${fetchError.message}`);
    }
    
    console.log(`📊 [BUSINESS-INFO-UPDATE] 기존 데이터: ${existingBusinesses?.length || 0}개`);
    
    // 2. 매칭 및 업데이트 계획 수립
    const matchResults = [];
    const unmatchedItems = [];
    const newBusinesses = [];
    
    for (const excelBusiness of excelData) {
      if (!excelBusiness.사업장명?.trim()) {
        console.warn(`⚠️ 사업장명이 없는 데이터 스킵: 행 ${excelBusiness.originalIndex}`);
        continue;
      }
      
      const { match, similarity } = findBestMatch(excelBusiness, existingBusinesses || []);
      
      if (match) {
        matchResults.push({
          excelData: excelBusiness,
          dbData: match,
          similarity,
          action: 'update'
        });
      } else {
        unmatchedItems.push(excelBusiness);
        newBusinesses.push({
          excelData: excelBusiness,
          action: 'insert'
        });
      }
    }
    
    console.log(`🔍 [BUSINESS-INFO-UPDATE] 매칭 결과: 매칭됨 ${matchResults.length}개, 신규 ${newBusinesses.length}개, 매칭안됨 ${unmatchedItems.length}개`);
    
    // 3. 미리보기 모드
    if (preview) {
      return NextResponse.json({
        success: true,
        preview: {
          matched: matchResults.length,
          unmatched: unmatchedItems.length,
          newBusinesses: newBusinesses.length,
          totalExcel: excelData.length,
          totalDb: existingBusinesses?.length || 0
        },
        matchDetails: matchResults.slice(0, 10).map(result => ({
          excel: result.excelData.사업장명,
          db: result.dbData.business_name,
          similarity: result.similarity
        })),
        unmatchedItems: unmatchedItems.slice(0, 10),
        message: '미리보기 완료'
      });
    }
    
    // 4. 실제 업데이트 실행
    const updateResults = [];
    const insertResults = [];
    const failedItems = [];
    
    // 기존 사업장 업데이트
    for (const matchResult of matchResults) {
      try {
        const { excelData, dbData } = matchResult;
        
        const updateData = {
          business_name: excelData.사업장명,
          address: excelData.주소,
          manager_name: excelData.담당자명,
          manager_contact: excelData.담당자연락처,
          manager_position: excelData.담당자직급,
          representative_name: excelData.대표자,
          business_registration_number: excelData.사업자등록번호,
          business_type: excelData.업종,
          business_contact: excelData.사업장연락처,
          ph_meter: parseInt(excelData.PH센서 || '0') || 0,
          differential_pressure_meter: parseInt(excelData.차압계 || '0') || 0,
          temperature_meter: parseInt(excelData.온도계 || '0') || 0,
          discharge_current_meter: parseInt(excelData.배출전류계 || '0') || 0,
          fan_current_meter: parseInt(excelData.송풍전류계 || '0') || 0,
          pump_current_meter: parseInt(excelData.펌프전류계 || '0') || 0,
          gateway: parseInt(excelData.게이트웨이 || '0') || 0,
          vpn_wired: parseInt(excelData.VPN유선 || '0') || 0,
          vpn_wireless: parseInt(excelData.VPN무선 || '0') || 0,
          multiple_stack: parseInt(excelData.복수굴뚝 || '0') || 0,
          negotiation: excelData.네고 || '',
          updated_at: new Date().toISOString()
        };
        
        const { error: updateError } = await supabaseAdmin
          .from('business_info')
          .update(updateData)
          .eq('id', dbData.id);
        
        if (updateError) {
          throw new Error(`업데이트 실패: ${updateError.message}`);
        }
        
        updateResults.push({
          id: dbData.id,
          name: excelData.사업장명,
          action: 'updated'
        });
        
      } catch (error) {
        console.error(`❌ 업데이트 실패 - ${matchResult.excelData.사업장명}:`, error);
        failedItems.push({
          ...matchResult.excelData,
          error: error instanceof Error ? error.message : '알 수 없는 오류'
        });
      }
    }
    
    // 신규 사업장 추가
    for (const newBusiness of newBusinesses) {
      try {
        const { excelData } = newBusiness;
        
        const insertData = {
          business_name: excelData.사업장명,
          address: excelData.주소,
          manager_name: excelData.담당자명,
          manager_contact: excelData.담당자연락처,
          manager_position: excelData.담당자직급,
          representative_name: excelData.대표자,
          business_registration_number: excelData.사업자등록번호,
          business_type: excelData.업종,
          business_contact: excelData.사업장연락처,
          ph_meter: parseInt(excelData.PH센서 || '0') || 0,
          differential_pressure_meter: parseInt(excelData.차압계 || '0') || 0,
          temperature_meter: parseInt(excelData.온도계 || '0') || 0,
          discharge_current_meter: parseInt(excelData.배출전류계 || '0') || 0,
          fan_current_meter: parseInt(excelData.송풍전류계 || '0') || 0,
          pump_current_meter: parseInt(excelData.펌프전류계 || '0') || 0,
          gateway: parseInt(excelData.게이트웨이 || '0') || 0,
          vpn_wired: parseInt(excelData.VPN유선 || '0') || 0,
          vpn_wireless: parseInt(excelData.VPN무선 || '0') || 0,
          multiple_stack: parseInt(excelData.복수굴뚝 || '0') || 0,
          negotiation: excelData.네고 || '',
          is_active: true,
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        const { data: insertedData, error: insertError } = await supabaseAdmin
          .from('business_info')
          .upsert(insertData, { 
            onConflict: 'business_name',
            ignoreDuplicates: false 
          })
          .select()
          .single();
        
        if (insertError) {
          throw new Error(`삽입 실패: ${insertError.message}`);
        }
        
        insertResults.push({
          id: insertedData.id,
          name: excelData.사업장명,
          action: 'inserted'
        });
        
      } catch (error) {
        console.error(`❌ 삽입 실패 - ${newBusiness.excelData.사업장명}:`, error);
        failedItems.push({
          ...newBusiness.excelData,
          error: error instanceof Error ? error.message : '알 수 없는 오류'
        });
      }
    }
    
    const summary = {
      total: excelData.length,
      matched: matchResults.length,
      updated: updateResults.length,
      inserted: insertResults.length,
      failed: failedItems.length
    };
    
    console.log(`✅ [BUSINESS-INFO-UPDATE] 업데이트 완료 - 성공: ${summary.updated + summary.inserted}개, 실패: ${summary.failed}개`);
    
    return NextResponse.json({
      success: true,
      summary,
      updateResults,
      insertResults,
      failedItems: failedItems.slice(0, 20), // 처음 20개만 반환
      message: `업데이트 완료: 업데이트 ${summary.updated}개, 추가 ${summary.inserted}개, 실패 ${summary.failed}개`
    });
    
  } catch (error) {
    console.error('❌ [BUSINESS-INFO-UPDATE] 업데이트 API 실패:', error);
    return NextResponse.json({
      success: false,
      message: '업데이트 처리 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { status: 500 });
  }
}