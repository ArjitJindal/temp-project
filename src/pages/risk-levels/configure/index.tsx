import RiskClassification from './RiskClassification';
import PageWrapper from '@/components/PageWrapper';
import { Feature } from '@/components/AppWrapper/FeaturesProvider';

export default function () {
  return (
    <Feature name="PULSE" fallback={'Not enabled'}>
      <PageWrapper>
        <div style={{ maxWidth: '800px' }}>
          <RiskClassification />
        </div>
      </PageWrapper>
    </Feature>
  );
}
