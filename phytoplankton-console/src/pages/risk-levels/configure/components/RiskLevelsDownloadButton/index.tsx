import { useCallback } from 'react';
import { RiskClassificationScore } from '@/apis';
import Button from '@/components/library/Button';
import { downloadAsCSV } from '@/utils/csv';
import DownloadLineIcon from '@/components/ui/icons/Remix/system/download-line.react.svg';

export default function RiskLevelsDownloadButton({
  classificationValues,
  isDisabled,
}: {
  classificationValues: RiskClassificationScore[];
  isDisabled?: boolean;
}) {
  const handleDownload = useCallback(() => {
    downloadAsCSV({
      headers: ['Risk level', 'Lower bound', 'Upper bound'],
      rows: classificationValues.map((item) => [
        { value: item.riskLevel },
        { value: item.lowerBoundRiskScore.toFixed(2) },
        { value: item.upperBoundRiskScore.toFixed(2) },
      ]),
    });
  }, [classificationValues]);
  return (
    <Button
      type="TETRIARY"
      onClick={handleDownload}
      icon={<DownloadLineIcon />}
      isDisabled={isDisabled}
    >
      Download
    </Button>
  );
}
