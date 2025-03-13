import { useMemo, useState } from 'react';
import AlertStatusChangeModal from '../../components/AlertsStatusChangeButton/AlertsStatusChangeModal';
import s from './index.module.less';
import Tooltip from '@/components/library/Tooltip';
import { CaseStatus } from '@/apis';
import Tag from '@/components/library/Tag';
import { useDemoMode } from '@/components/AppWrapper/Providers/DemoModeProvider';
import { getOr } from '@/utils/asyncResource';
import COLORS from '@/components/ui/colors';
import AiForensicsLogo from '@/components/ui/AiForensicsLogo';

interface Props {
  confidence: number;
  caseIds: string[];
  alertId?: string;
  newCaseStatus: CaseStatus;
  onSaved: () => void;
  isBlue?: boolean;
  rounded?: boolean;
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
  const { alertId, caseIds, onSaved, newCaseStatus, confidence } = props;
  const [isModalVisible, setModalVisible] = useState(false);

  const [isDemoMode] = useDemoMode();
  const demoMode = getOr(isDemoMode, false);

  const random3Reasons = useMemo(() => {
    return reasons.sort(() => Math.random() - 0.5).slice(0, 3);
  }, []);

  const title = useMemo(() => {
    if (demoMode) {
      return (
        <div className={s.tooltip}>
          <div className={s.tooltipTitle}>
            <div className={s.tooltipTitleLeft}>
              <AiForensicsLogo size="SMALL" variant="OVERVIEW" />
            </div>
            <div className={s.tooltipTitleRight}>
              <FalsePostiveLabel confidence={confidence} />
            </div>
          </div>
          <ul className={s.tooltipList}>
            {random3Reasons.map((value) => (
              <li key={value}>{value}</li>
            ))}
          </ul>
        </div>
      );
    }

    return <div>Accuracy increases as you close more cases.</div>;
  }, [demoMode, random3Reasons, confidence]);

  return (
    <>
      <Tooltip overlay={title} color={COLORS.white} placement="bottomRight">
        <div>
          <FalsePostiveLabel confidence={confidence} onClick={() => setModalVisible(true)} />
        </div>
      </Tooltip>
      <AlertStatusChangeModal
        entityIds={[alertId ?? '']}
        caseId={caseIds[0]}
        isVisible={isModalVisible}
        newStatus={newCaseStatus}
        defaultReasons={newCaseStatus === 'CLOSED' ? ['False positive'] : []}
        onSaved={onSaved}
        onClose={() => {
          setModalVisible(false);
        }}
      />
    </>
  );
};
