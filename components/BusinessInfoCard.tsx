import { BusinessInfo } from '@/types';
import { Building2, User, Phone, MapPin } from 'lucide-react';

interface BusinessInfoCardProps {
  businessInfo: BusinessInfo;
  loading: boolean;
}

function BusinessInfoCard({ businessInfo, loading }: BusinessInfoCardProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center gap-2 mb-6">
          <Building2 className="w-6 h-6 text-blue-600" />
          <h3 className="text-xl font-bold text-gray-900">사업장 정보</h3>
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded mb-2" />
              <div className="h-6 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!businessInfo.found) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-6 h-6 text-blue-600" />
          <h3 className="text-xl font-bold text-gray-900">사업장 정보</h3>
        </div>
        <div className="text-center py-8">
          <p className="text-gray-500">사업장 정보를 찾을 수 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center gap-2 mb-6">
        <Building2 className="w-6 h-6 text-blue-600" />
        <h3 className="text-xl font-bold text-gray-900">사업장 정보</h3>
      </div>
      
      <div className="grid gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-600">사업장 담당자</span>
          </div>
          <div className="text-lg font-semibold text-blue-600">
            {businessInfo.manager || '정보 없음'}
            {businessInfo.position && (
              <span className="text-sm text-gray-500 ml-2">({businessInfo.position})</span>
            )}
          </div>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Phone className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-600">연락처</span>
          </div>
          <div className="text-lg font-semibold text-blue-600">
            {businessInfo.contact ? (
              <a href={`tel:${businessInfo.contact}`} className="hover:underline">
                {businessInfo.contact}
              </a>
            ) : (
              '정보 없음'
            )}
          </div>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-600">주소</span>
          </div>
          <div className="text-lg font-semibold text-blue-600 break-all">
            {businessInfo.address || '정보 없음'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default BusinessInfoCard;
