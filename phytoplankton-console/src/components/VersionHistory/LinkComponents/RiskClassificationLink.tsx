import Tag from '@/components/library/Tag';
import Link from '@/components/ui/Link';
import { useRiskClassificationConfig } from '@/utils/risk-levels';

export default function RiskClassificationLink({ versionId }: { versionId: string }) {
  const riskClassifications = useRiskClassificationConfig();

  return (
    <Link to={`/risk-levels/version-history/${versionId}`}>
      {riskClassifications.data.id === versionId ? (
        <span>
          {versionId} <Tag color="green">Active</Tag>
        </span>
      ) : (
        versionId
      )}
    </Link>
  );
}
