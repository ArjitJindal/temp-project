import HeaderLayout from './HeaderLayout';
import { Props } from '.';
import Button from '@/components/library/Button';
import EditIcon from '@/components/ui/icons/Remix/design/edit-line.react.svg';
import RiskLevelsDownloadButton from '@/pages/risk-levels/configure/components/RiskLevelsDownloadButton';

export default function DefaultActions(props: Props) {
  const { riskValues, updateEnabledState } = props;
  const [isUpdateEnabled, setIsUpdateEnabled] = updateEnabledState;

  return (
    <>
      {!isUpdateEnabled && (
        <HeaderLayout>
          <Button
            type="SECONDARY"
            onClick={() => setIsUpdateEnabled(true)}
            isDisabled={!riskValues.classificationValues.length || isUpdateEnabled}
            icon={<EditIcon />}
          >
            Update risk levels
          </Button>
          <RiskLevelsDownloadButton classificationValues={riskValues.classificationValues} />
        </HeaderLayout>
      )}
    </>
  );
}
