import Tag from '@/components/library/Tag';
import Link from '@/components/ui/Link';
import { useMaxVersionIdRiskFactors } from '@/hooks/api/version-history';

export default function RiskFactorLink({ versionId }: { versionId: string }) {
  const maxVersionId = useMaxVersionIdRiskFactors();
  return (
    <Link to={`/risk-levels/risk-factors/version-history/${versionId}/consumer`}>
      {versionId === `RFV-${maxVersionId}` ? (
        <span>
          {versionId} <Tag color="green">Active</Tag>
        </span>
      ) : (
        versionId
      )}
    </Link>
  );
}
