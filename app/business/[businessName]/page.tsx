import { Metadata } from 'next';
import BusinessContent from './BusinessContent';

type Props = {
  params: { businessName: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
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

export default function BusinessDetailPage() {
  return <BusinessContent />;
}
