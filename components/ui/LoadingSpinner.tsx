// components/ui/LoadingSpinner.tsx - 모바일 최적화
import { Building2 } from 'lucide-react';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function LoadingSpinner({ 
  message = '데이터를 불러오는 중입니다...', 
  size = 'md' 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };
  
  const containerClasses = {
    sm: 'p-4',
    md: 'p-8',
    lg: 'p-12'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center px-4">
      <div className={`bg-white rounded-xl shadow-2xl text-center max-w-sm w-full ${containerClasses[size]}`}>
        {/* 로딩 애니메이션 */}
        <div className="flex flex-col items-center space-y-4">
          {/* 빌딩 아이콘 + 회전 효과 */}
          <div className="relative">
            <Building2 className={`${sizeClasses[size]} text-blue-600 animate-pulse`} />
            <div className={`absolute inset-0 ${sizeClasses[size]} border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin`}></div>
          </div>
          
          {/* 메시지 */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-900">
              잠시만 기다려주세요
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              {message}
            </p>
          </div>
          
          {/* 진행률 바 (시각적 효과용) */}
          <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
            <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{
              width: '60%',
              animation: 'loading-progress 2s ease-in-out infinite'
            }}></div>
          </div>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes loading-progress {
          0% { width: 20%; }
          50% { width: 80%; }
          100% { width: 20%; }
        }
      `}</style>
    </div>
  );
}
