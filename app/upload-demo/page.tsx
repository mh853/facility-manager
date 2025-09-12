// app/upload-demo/page.tsx
// Progressive Upload 데모 페이지

import SimpleProgressDemo from '@/components/SimpleProgressDemo';

export default function UploadDemoPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      <SimpleProgressDemo businessName="데모 테스트 사업장" />
    </div>
  );
}