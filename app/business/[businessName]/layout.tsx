import { Metadata } from 'next';

type Props = {
  params: { businessName: string };
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // URL 디코딩하여 사업장명 추출
  const businessName = decodeURIComponent(params.businessName);

  return {
    title: `${businessName} - 시설 관리 시스템`,
    description: `${businessName}의 시설 정보 관리 및 보고서`,
    openGraph: {
      title: `${businessName} - 시설 관리 시스템`,
      description: `${businessName}의 시설 정보 관리 및 보고서`,
      url: `https://facility.blueon-iot.com/business/${params.businessName}`,
      type: 'website',
      locale: 'ko_KR',
    },
  };
}

export default function BusinessLayout({ children }: Props) {
  return <>{children}</>;
}
