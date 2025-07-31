import { EditOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router';
import { useAtom } from 'jotai';
import { ScopeSelectorValue } from './utils';
import s from './styles.module.less';
import { riskFactorsEditEnabled } from '@/store/risk-factors';
import SegmentedControl from '@/components/library/SegmentedControl';
import { makeUrl } from '@/utils/routing';
import Button from '@/components/library/Button';
import { useHasResources } from '@/utils/user-utils';
import { useBulkRerunUsersStatus } from '@/utils/batch-rerun-users';

interface Props {
  selectedSection: ScopeSelectorValue;
  setSelectedSection: (value: ScopeSelectorValue) => void;
  mode: 'simulation' | 'normal' | 'version-history';
  canEditRiskFactors: boolean;
  jobId?: string;
  activeIterationIndex?: number;
}

export const TableHeader = ({
  selectedSection,
  setSelectedSection,
  mode,
  canEditRiskFactors,
  jobId,
  activeIterationIndex,
}: Props) => {
  const isSimulation = mode === 'simulation';
  const isVersionHistory = mode === 'version-history';
  const navigate = useNavigate();
  const canWriteRiskFactors =
    useHasResources(['write:::risk-scoring/risk-factors/*']) && canEditRiskFactors !== false;

  const [isEditEnabled, setIsEditEnabled] = useAtom(riskFactorsEditEnabled);
  const riskScoringRerun = useBulkRerunUsersStatus();

  return (
    <div className={s.header}>
      <SegmentedControl<ScopeSelectorValue>
        size="MEDIUM"
        active={selectedSection}
        onChange={(newValue) => {
          setSelectedSection(newValue);
        }}
        items={[
          { value: 'consumer', label: 'Consumer' },
          { value: 'business', label: 'Business' },
          { value: 'transaction', label: 'Transaction' },
        ]}
      />
      <div className={s.headerButtons}>
        {!isSimulation && !isEditEnabled && !isVersionHistory && (
          <Button
            size="MEDIUM"
            type="SECONDARY"
            onClick={() => {
              setIsEditEnabled(true);
            }}
            isDisabled={!canWriteRiskFactors}
            icon={<EditOutlined />}
            testName="edit-risk-factors-button"
          >
            Edit
          </Button>
        )}
        {!isEditEnabled && !isVersionHistory && (
          <Button
            size="MEDIUM"
            type="SECONDARY"
            onClick={() => {
              if (isSimulation) {
                navigate(
                  makeUrl(`/risk-levels/risk-factors/simulation-mode/:key/:type/create`, {
                    key: `${jobId ? jobId : 'new'}-${activeIterationIndex}`,
                    type: selectedSection,
                  }),
                  { replace: true },
                );
              } else {
                const url = makeUrl(`/risk-levels/risk-factors/:type/create`, {
                  type: selectedSection,
                });
                navigate(url, { replace: true });
              }
            }}
            isDisabled={!canWriteRiskFactors || riskScoringRerun.data.isAnyJobRunning}
            testName="create-risk-factor-button"
          >
            {isSimulation ? 'Simulate risk factor' : 'Custom risk factor'}
          </Button>
        )}
      </div>
    </div>
  );
};
