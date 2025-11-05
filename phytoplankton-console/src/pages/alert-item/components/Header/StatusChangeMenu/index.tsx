import { MoreOutlined } from '@ant-design/icons';
import React from 'react';
import s from './style.module.less';
import Dropdown, { DropdownOption } from '@/components/library/Dropdown';
import Button from '@/components/library/Button';
import { Alert } from '@/apis';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import {
  canMutateEscalatedCases,
  isEscalatedCases,
  isEscalatedL2Cases,
  isInReviewCases,
} from '@/utils/case-utils';
import AlertsStatusChangeButton from '@/pages/case-management/components/AlertsStatusChangeButton';
import { useAuth0User } from '@/utils/user-utils';

interface Props {
  alertItem: Alert;
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
          isDisabled={isDisabled}
          icon={<MoreOutlined />}
        />
      </Dropdown>
    </div>
  );
};

function useOptions(props: Props): DropdownOption[] {
  const user = useAuth0User();
  const { alertItem } = props;
  const { alertId, alertStatus, caseId } = alertItem;
  const escalationEnabled = useFeatureEnabled('ADVANCED_WORKFLOWS');
  const isMultiLevelEscalationEnabled = useFeatureEnabled('MULTI_LEVEL_ESCALATION');

  if (!caseId || !alertId) {
    return [];
  }
  const isAlertEscalated = isEscalatedCases({ [alertId]: alertItem }, true);
  const isAlertEscalatedL2 = isEscalatedL2Cases({ [alertId]: alertItem }, true);
  const isAlertInReview = isInReviewCases({ [alertId]: alertItem }, true);

  const result: DropdownOption[] = [];

  const canEscalate = canMutateEscalatedCases(
    { [caseId]: alertItem },
    user.userId,
    isMultiLevelEscalationEnabled,
  );

  if (escalationEnabled && canEscalate && alertStatus && !isAlertInReview) {
    if (!isAlertEscalated && !isAlertEscalatedL2) {
      result.push({
        value: 'ESCALATED_SEND_BACK',
        label: (
          <AlertsStatusChangeButton
            buttonProps={{
              type: 'TEXT',
            }}
            ids={[alertId]}
            transactionIds={{}}
            onSaved={props.onReload}
            status={alertStatus}
            caseId={caseId}
            statusTransitions={{
              OPEN: { status: 'ESCALATED', actionLabel: 'Escalate' },
              REOPENED: { status: 'ESCALATED', actionLabel: 'Escalate' },
              CLOSED: { status: 'ESCALATED', actionLabel: 'Escalate' },
              OPEN_IN_PROGRESS: { status: 'ESCALATED', actionLabel: 'Escalate' },
              OPEN_ON_HOLD: { status: 'ESCALATED', actionLabel: 'Escalate' },
            }}
            isDisabled={props.isDisabled}
            haveModal={true}
            alertsData={[{ alertId, ruleNature: alertItem.ruleNature }]}
          />
        ),
      });
    } else if (isMultiLevelEscalationEnabled && isAlertEscalated && !isAlertEscalatedL2) {
      result.push({
        value: 'ESCALATE_L2',
        label: (
          <AlertsStatusChangeButton
            buttonProps={{
              type: 'TEXT',
            }}
            ids={[alertId]}
            caseId={caseId}
            status={alertStatus}
            onSaved={props.onReload}
            transactionIds={{}}
            isDisabled={props.isDisabled}
            statusTransitions={{
              ESCALATED: { status: 'ESCALATED_L2', actionLabel: 'Escalate L2' },
              ESCALATED_IN_PROGRESS: { status: 'ESCALATED_L2', actionLabel: 'Escalate L2' },
              ESCALATED_ON_HOLD: { status: 'ESCALATED_L2', actionLabel: 'Escalate L2' },
            }}
            haveModal={true}
            alertsData={[{ alertId, ruleNature: alertItem.ruleNature }]}
          />
        ),
      });
    }
  }

  return result;
}

export default StatusChangeMenu;
