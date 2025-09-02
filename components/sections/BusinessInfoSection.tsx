'use client';

import { useState, useEffect } from 'react';
import { Building2, MapPin, Phone, Calendar, User, Navigation, ExternalLink } from 'lucide-react';
import { BusinessInfo } from '@/types';
import { createPhoneLink, openNavigation } from '@/utils/contact';

interface BusinessInfoSectionProps {
  businessInfo: BusinessInfo;
}

export default function BusinessInfoSection({ businessInfo }: BusinessInfoSectionProps) {
  const [contactInfo, setContactInfo] = useState<BusinessInfo>(businessInfo);
  const [loading, setLoading] = useState(false);

  // 연락처 정보 로드 (기본값 사용)
  useEffect(() => {
    setContactInfo(businessInfo);
    setLoading(false);
  }, [businessInfo]);

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 shadow-sm border border-blue-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Building2 className="w-6 h-6 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">사업장 정보</h2>
        </div>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-2">연락처 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 shadow-sm border border-blue-100">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Building2 className="w-6 h-6 text-blue-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-800">사업장 정보</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-gray-500" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">사업장명</p>
              <p className="text-lg font-semibold text-gray-800">
                {contactInfo.사업장명 || businessInfo.businessName || businessInfo.사업장명 || '정보 없음'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-gray-500" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">주소</p>
              <div className="flex items-center justify-between">
                <p className="text-gray-800 flex-1">{contactInfo.주소 || '정보 없음'}</p>
                {contactInfo.주소 && contactInfo.주소 !== '정보 없음' && (
                  <button
                    onClick={() => openNavigation(contactInfo.주소!)}
                    className="ml-2 p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                    title="네비게이션으로 길찾기"
                  >
                    <Navigation className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Phone className="w-5 h-5 text-gray-500" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">사업장 연락처</p>
              <div className="flex items-center justify-between">
                {contactInfo.사업장연락처 && contactInfo.사업장연락처 !== '정보 없음' ? (
                  <a 
                    href={createPhoneLink(contactInfo.사업장연락처)}
                    className="text-blue-600 hover:text-blue-800 hover:underline transition-colors flex-1"
                    title="전화걸기"
                  >
                    {contactInfo.사업장연락처}
                  </a>
                ) : (
                  <p className="text-gray-800 flex-1">정보 없음</p>
                )}
                {contactInfo.사업장연락처 && contactInfo.사업장연락처 !== '정보 없음' && (
                  <Phone className="w-4 h-4 text-blue-600 ml-2" />
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-gray-500" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">담당자명</p>
              <div className="flex items-center gap-2">
                <p className="text-gray-800">{contactInfo.담당자명 || '정보 없음'}</p>
                {contactInfo.담당자직급 && contactInfo.담당자직급 !== '정보 없음' && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                    {contactInfo.담당자직급}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Phone className="w-5 h-5 text-gray-500" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">담당자 연락처</p>
              <div className="flex items-center justify-between">
                {contactInfo.담당자연락처 && contactInfo.담당자연락처 !== '정보 없음' ? (
                  <a 
                    href={createPhoneLink(contactInfo.담당자연락처)}
                    className="text-blue-600 hover:text-blue-800 hover:underline transition-colors flex-1"
                    title="전화걸기"
                  >
                    {contactInfo.담당자연락처}
                  </a>
                ) : (
                  <p className="text-gray-800 flex-1">정보 없음</p>
                )}
                {contactInfo.담당자연락처 && contactInfo.담당자연락처 !== '정보 없음' && (
                  <Phone className="w-4 h-4 text-blue-600 ml-2" />
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-gray-500" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">대표자</p>
              <p className="text-gray-800">{contactInfo.대표자 || '정보 없음'}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-gray-500" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">사업자등록번호</p>
              <p className="text-gray-800">{contactInfo.사업자등록번호 || '정보 없음'}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-gray-500" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">업종</p>
              <p className="text-gray-800">{contactInfo.업종 || '정보 없음'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}