// lib/business-bridge.ts - Read-Only Bridge for businesses table access
import { supabaseAdmin } from './supabase';

export interface BusinessFileStats {
  businessName: string;
  totalFiles: number;
  lastUploadDate: string | null;
  fileCategories: string[];
  storageUrl: string;
  correlationScore: number;
}

export interface BusinessCorrelation {
  businessInfoName: string;
  businessesName: string | null;
  correlationScore: number;
  matchType: 'exact' | 'fuzzy' | 'none';
}

export class BusinessBridge {
  // Read-Only 접근: businesses 테이블에서 파일 통계 조회
  static async getFileStatistics(businessName: string): Promise<BusinessFileStats | null> {
    try {
      console.log(`🔍 [BRIDGE] 파일 통계 조회: ${businessName}`);

      // businesses 테이블에서 Read-Only 조회
      const { data: businessData, error } = await supabaseAdmin
        .from('businesses')
        .select('name, fileStats, url, createdAt, updatedAt')
        .eq('name', businessName)
        .single();

      if (error || !businessData) {
        console.log(`⚠️ [BRIDGE] 파일 통계 없음: ${businessName}`);
        return null;
      }

      return {
        businessName: businessData.name,
        totalFiles: businessData.fileStats?.total || 0,
        lastUploadDate: businessData.updatedAt || businessData.createdAt,
        fileCategories: this.extractFileCategories(businessData.fileStats),
        storageUrl: businessData.url || '',
        correlationScore: 1.0 // exact match
      };

    } catch (error) {
      console.error(`❌ [BRIDGE] 파일 통계 조회 실패:`, error);
      return null;
    }
  }

  // 사업장명 상관관계 분석 (한글 정규화 포함)
  static async findBusinessCorrelation(businessInfoName: string): Promise<BusinessCorrelation> {
    try {
      console.log(`🔍 [BRIDGE] 상관관계 분석: ${businessInfoName}`);

      // 1. 정확한 이름 매칭
      const { data: exactMatch } = await supabaseAdmin
        .from('businesses')
        .select('name')
        .eq('name', businessInfoName)
        .single();

      if (exactMatch) {
        return {
          businessInfoName,
          businessesName: exactMatch.name,
          correlationScore: 1.0,
          matchType: 'exact'
        };
      }

      // 2. 퍼지 매칭 (공백, 특수문자 제거 후 비교)
      const normalizedTarget = this.normalizeBusinessName(businessInfoName);
      
      const { data: allBusinesses } = await supabaseAdmin
        .from('businesses')
        .select('name');

      if (allBusinesses) {
        for (const business of allBusinesses) {
          const normalizedBusiness = this.normalizeBusinessName(business.name);
          const score = this.calculateSimilarityScore(normalizedTarget, normalizedBusiness);
          
          if (score >= 0.8) {
            return {
              businessInfoName,
              businessesName: business.name,
              correlationScore: score,
              matchType: 'fuzzy'
            };
          }
        }
      }

      // 3. 매칭 실패
      return {
        businessInfoName,
        businessesName: null,
        correlationScore: 0.0,
        matchType: 'none'
      };

    } catch (error) {
      console.error(`❌ [BRIDGE] 상관관계 분석 실패:`, error);
      return {
        businessInfoName,
        businessesName: null,
        correlationScore: 0.0,
        matchType: 'none'
      };
    }
  }

  // 한글 사업장명 정규화 (매칭 정확도 향상)
  private static normalizeBusinessName(name: string): string {
    if (!name) return '';
    
    return name
      .replace(/\s+/g, '') // 공백 제거
      .replace(/[()（）]/g, '') // 괄호 제거
      .replace(/[-.]/g, '') // 하이픈, 점 제거
      .toLowerCase()
      .normalize('NFC'); // 한글 정규화
  }

  // 문자열 유사도 계산 (Jaccard Similarity)
  private static calculateSimilarityScore(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (!str1 || !str2) return 0.0;

    const set1 = new Set(str1);
    const set2 = new Set(str2);
    
    const intersection = new Set([...set1].filter(char => set2.has(char)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  // 파일 카테고리 추출
  private static extractFileCategories(fileStats: any): string[] {
    if (!fileStats) return [];
    
    const categories = [];
    if (fileStats.uploaded > 0) categories.push('업로드완료');
    if (fileStats.syncing > 0) categories.push('동기화중');
    if (fileStats.failed > 0) categories.push('실패');
    
    return categories;
  }

  // 대량 상관관계 분석 (어드민 페이지 로딩용)
  static async batchCorrelateBusinesses(businessInfoList: any[]): Promise<Map<string, BusinessFileStats>> {
    try {
      console.log(`🔍 [BRIDGE] 대량 상관관계 분석 시작: ${businessInfoList.length}개`);

      // businesses 테이블 전체 조회 (한 번만)
      const { data: allBusinesses } = await supabaseAdmin
        .from('businesses')
        .select('name, fileStats, url, createdAt, updatedAt');

      const correlationMap = new Map<string, BusinessFileStats>();

      if (!allBusinesses) return correlationMap;

      // 각 business_info에 대해 매칭 시도
      for (const businessInfo of businessInfoList) {
        const businessName = businessInfo.business_name || businessInfo.사업장명;
        if (!businessName) continue;

        // 정확한 매칭 우선
        let matchedBusiness = allBusinesses.find((b: any) => b.name === businessName);
        
        // 퍼지 매칭 시도
        if (!matchedBusiness) {
          const normalized = this.normalizeBusinessName(businessName);
          matchedBusiness = allBusinesses.find((b: any) => 
            this.calculateSimilarityScore(normalized, this.normalizeBusinessName(b.name)) >= 0.8
          );
        }

        if (matchedBusiness) {
          correlationMap.set(businessInfo.id, {
            businessName: matchedBusiness.name,
            totalFiles: matchedBusiness.fileStats?.total || 0,
            lastUploadDate: matchedBusiness.updatedAt || matchedBusiness.createdAt,
            fileCategories: this.extractFileCategories(matchedBusiness.fileStats),
            storageUrl: matchedBusiness.url || '',
            correlationScore: matchedBusiness.name === businessName ? 1.0 : 0.8
          });
        }
      }

      console.log(`✅ [BRIDGE] 대량 분석 완료: ${correlationMap.size}개 매칭`);
      return correlationMap;

    } catch (error) {
      console.error(`❌ [BRIDGE] 대량 분석 실패:`, error);
      return new Map();
    }
  }
}

export default BusinessBridge;