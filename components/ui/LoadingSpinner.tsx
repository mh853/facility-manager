// components/ui/LoadingSpinner.tsx - 모바일 최적화
import { Building2, Database, Wifi } from 'lucide-react';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  type?: 'default' | 'business' | 'data';
}

export default function LoadingSpinner({ 
  message = '데이터를 불러오는 중입니다...', 
  size = 'md',
  type = 'default'
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

  const getIcon = () => {
    switch (type) {
      case 'business':
        return <Building2 className={`${sizeClasses[size]} text-blue-600 animate-pulse`} />;
      case 'data':
        return <Database className={`${sizeClasses[size]} text-green-600 animate-pulse`} />;
      default:
        return <Building2 className={`${sizeClasses[size]} text-blue-600 animate-pulse`} />;
    }
  };

  const getGradient = () => {
    switch (type) {
      case 'business':
        return 'from-blue-50 to-indigo-50';
      case 'data':
        return 'from-green-50 to-emerald-50';
      default:
        return 'from-blue-600 to-blue-800';
    }
  };

  const getSpinnerColor = () => {
    switch (type) {
      case 'business':
        return 'border-blue-200 border-t-blue-600';
      case 'data':
        return 'border-green-200 border-t-green-600';
      default:
        return 'border-blue-200 border-t-blue-600';
    }
  };

  const getProgressColor = () => {
    switch (type) {
      case 'business':
        return 'bg-blue-600';
      case 'data':
        return 'bg-green-600';
      default:
        return 'bg-blue-600';
    }
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br ${getGradient()} flex items-center justify-center px-4`}>
      <div className={`bg-white rounded-2xl shadow-2xl text-center max-w-md w-full ${containerClasses[size]} border border-gray-100`}>
        {/* 로딩 애니메이션 */}
        <div className="flex flex-col items-center space-y-6">
          {/* 아이콘 + 회전 효과 */}
          <div className="relative">
            {getIcon()}
            <div className={`absolute inset-0 ${sizeClasses[size]} border-4 ${getSpinnerColor()} rounded-full animate-spin`}></div>
          </div>
          
          {/* 메시지 */}
          <div className="space-y-3">
            <h3 className="text-xl font-bold text-gray-900">
              잠시만 기다려주세요
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed px-2">
              {message}
            </p>
          </div>
          
          {/* 진행률 바 */}
          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <div className={`${getProgressColor()} h-2.5 rounded-full animate-pulse transition-all duration-1000`} 
                 style={{
                   width: '65%',
                   animation: 'loading-progress 2.5s ease-in-out infinite'
                 }}>
            </div>
          </div>
          
          {/* 연결 상태 */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Wifi className="w-3 h-3 text-green-500" />
            <span>서버 연결됨</span>
          </div>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes loading-progress {
          0% { width: 25%; }
          50% { width: 85%; }
          100% { width: 25%; }
        }
      `}</style>
    </div>
  );
}