import { MoreOutlined } from '@ant-design/icons';
import { useMemo } from 'react';
import s from './style.module.less';
import Dropdown from '@/components/library/Dropdown';
import Button from '@/components/library/Button';
import { Case } from '@/apis';
import CasesStatusChangeButton from '@/pages/case-management/components/CasesStatusChangeButton';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import {
  canReviewCases,
  findLastStatusForInReview,
  isInReviewCases,
  statusInReview,
} from '@/utils/case-utils';
import {
  APPROVE_STATUS_TRANSITIONS,
  DECLINE_STATUS_TRANSITIONS,
} from '@/pages/case-management/components/ApproveSendBackButton';
import { useAuth0User } from '@/utils/user-utils';

interface Props {
  caseItem: Case;
  isDisabled: boolean;
  onReload: () => void;
}

const StatusChangeMenu = (props: Props) => {
  const { isDisabled } = props;
  const options = useOptions(props);
  if (options.length === 0) {
    return <></>;
  }
  return (
    <div>
      <Dropdown options={options} optionClassName={s.option} disabled={isDisabled}>
        <Button
          type="TETRIARY"
          testName="status-options-button"
          className={s.button}
          isDisabled={isDisabled}
        >
          <MoreOutlined />
        </Button>
      </Dropdown>
    </div>
  );
};
const useOptions = (props: Props) => {
  const { caseItem, onReload } = props;
  const { caseId } = caseItem;
  const caseClosedBefore = Boolean(
    caseItem.statusChanges?.find((statusChange) => statusChange.caseStatus === 'CLOSED'),
  );
  const escalationEnabled = useFeatureEnabled('ADVANCED_WORKFLOWS');
  const isReview = useMemo(() => statusInReview(caseItem.caseStatus), [caseItem]);
  const previousStatus = useMemo(() => {
    return findLastStatusForInReview(caseItem.statusChanges ?? []);
  }, [caseItem]);

  const currentUser = useAuth0User();
  const displayApproveButtons = useMemo(() => {
    if (!caseId) {
      return false;
    }
    return (
      isInReviewCases({ [caseId]: caseItem }) &&
      canReviewCases({ [caseId]: caseItem }, currentUser.userId)
    );
  }, [caseItem, caseId, currentUser]);
  return [
    ...(escalationEnabled && !isReview && caseId
      ? [
          {
            value: 'ESCALATE',
            label: (
              <CasesStatusChangeButton
                caseIds={[caseId]}
                caseStatus={caseItem.caseStatus}
                onSaved={onReload}
                statusTransitions={{
                  OPEN: { status: 'ESCALATED', actionLabel: 'Escalate' },
                  REOPENED: { status: 'ESCALATED', actionLabel: 'Escalate' },
                  ESCALATED: {
                    status: caseClosedBefore ? 'REOPENED' : 'OPEN',
                    actionLabel: 'Send back',
                  },
                  CLOSED: { status: 'ESCALATED', actionLabel: 'Escalate' },
                  OPEN_IN_PROGRESS: { status: 'ESCALATED', actionLabel: 'Escalate' },
                  OPEN_ON_HOLD: { status: 'ESCALATED', actionLabel: 'Escalate' },
                  ESCALATED_IN_PROGRESS: {
                    status: caseClosedBefore ? 'REOPENED' : 'OPEN',
                    actionLabel: 'Send back',
                  },
                  ESCALATED_ON_HOLD: {
                    status: caseClosedBefore ? 'REOPENED' : 'OPEN',
                    actionLabel: 'Send back',
                  },
                }}
                className={s.statusButton}
              />
            ),
          },
        ]
      : []),
    ...(isReview && caseId && displayApproveButtons
      ? [
          {
            value: 'APPROVE',
            label: (
              <CasesStatusChangeButton
                caseIds={[caseId]}
                onSaved={onReload}
                caseStatus={caseItem.caseStatus ?? 'OPEN'}
                statusTransitions={APPROVE_STATUS_TRANSITIONS}
                skipReasonsModal
                className={s.statusButton}
              />
            ),
          },
        ]
      : []),
    ...(isReview && caseId && displayApproveButtons
      ? [
          {
            value: 'DECLINE',
            label: (
              <CasesStatusChangeButton
                caseIds={[caseId]}
                onSaved={onReload}
                caseStatus={previousStatus}
                statusTransitions={DECLINE_STATUS_TRANSITIONS}
                skipReasonsModal
                className={s.statusButton}
              />
            ),
          },
        ]
      : []),
  ];
};
export default StatusChangeMenu;
