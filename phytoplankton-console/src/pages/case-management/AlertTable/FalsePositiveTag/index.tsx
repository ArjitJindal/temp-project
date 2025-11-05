import { useMemo, useState } from 'react';
import { TableUser } from '../../CaseTable/types';
import AlertStatusChangeModal from '../../components/AlertsStatusChangeButton/AlertsStatusChangeModal';
import s from './index.module.less';
import Tooltip from '@/components/library/Tooltip';
import { CaseStatus } from '@/apis';
import Tag from '@/components/library/Tag';
import { useDemoMode } from '@/components/AppWrapper/Providers/DemoModeProvider';
import { getOr } from '@/utils/asyncResource';
import { OverviewToolTip } from '@/components/OverviewToolTip';

interface Props {
  confidence: number;
  caseIds: string[];
  alertId?: string;
  newCaseStatus: CaseStatus;
  onSaved: () => void;
  isBlue?: boolean;
  rounded?: boolean;
  user?: TableUser;
  ruleNature?: string;
}

const reasons: string[] = [
  'User has had false positives for same rule more than 3 times',
  'Average transaction risk score is low',
  'User behavior within expected bounds',
  'Recent user behavior does not indicate a strong anomaly',
  'All the historic alerts for this user have been false positives',
  'Same alert pattern previously investigated and cleared',
  "Transaction consistent with customer's risk profile",
  'Activity consistent with peer group behavior',
  'Marginal threshold breach',
  'One-time deviation with return to normal pattern',
  'Multiple trivial breaches aggregated into an alert',
  'No escalation in frequency or amount over time',
  'Activity consistent with historical seasonal patterns',
  'Transactions within expected transaction limits',
  'Expected end-of-month/quarter financial activities',
  'Expected holiday period transaction patterns',
];

const FalsePostiveLabel = (props: { confidence: number; onClick?: () => void }) => {
  const { confidence, onClick } = props;
  return (
    <Tag className={s.tag} onClick={onClick}>
      {confidence}% False positive
    </Tag>
  );
};

export const FalsePositiveTag: React.FC<Props> = (props: Props) => {
  const { alertId, caseIds, onSaved, newCaseStatus, confidence, user, ruleNature } = props;
  const [isModalVisible, setModalVisible] = useState(false);

  const [isDemoMode] = useDemoMode();
  const demoMode = getOr(isDemoMode, false);

  const random3Reasons = useMemo(() => {
    return reasons.sort(() => Math.random() - 0.5).slice(0, 3);
  }, []);

  return (
    <>
      {demoMode ? (
        <OverviewToolTip
          reasons={random3Reasons}
          right={<FalsePostiveLabel confidence={confidence} />}
        >
          <div>
            <FalsePostiveLabel confidence={confidence} onClick={() => setModalVisible(true)} />
          </div>
        </OverviewToolTip>
      ) : (
        <Tooltip title="Accuracy increases as you close more cases.">
          <div>
            <FalsePostiveLabel confidence={confidence} onClick={() => setModalVisible(true)} />
          </div>
        </Tooltip>
      )}
      <AlertStatusChangeModal
        entityIds={[alertId ?? '']}
        caseId={caseIds[0]}
        isVisible={isModalVisible}
        newStatus={newCaseStatus}
        defaultReasons={newCaseStatus === 'CLOSED' ? ['False positive'] : []}
        onSaved={onSaved}
        user={user}
        onClose={() => {
          setModalVisible(false);
        }}
        alertsData={alertId ? [{ alertId, ruleNature }] : undefined}
      />
    </>
  );
};
