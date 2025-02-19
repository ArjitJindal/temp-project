import { MoreOutlined } from '@ant-design/icons';
import React from 'react';
import s from './style.module.less';
import Dropdown from '@/components/library/Dropdown';
import Button from '@/components/library/Button';
import { Alert } from '@/apis';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { isEscalatedCases, isInReviewCases } from '@/utils/case-utils';
import AlertsStatusChangeButton from '@/pages/case-management/components/AlertsStatusChangeButton';

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

const useOptions = (props: Props) => {
  const { alertItem } = props;
  const { alertId, alertStatus, caseId } = alertItem;
  const escalationEnabled = useFeatureEnabled('ADVANCED_WORKFLOWS');

  if (!caseId || !alertId) {
    return [];
  }
  const isCaseHavingEscalated = isEscalatedCases({ [alertId]: alertItem }, true);
  const isReviewAlerts = isInReviewCases({ [alertId]: alertItem }, true);

  if (isCaseHavingEscalated || isReviewAlerts) {
    return [];
  }
  if (!escalationEnabled || !alertStatus || isReviewAlerts || isCaseHavingEscalated) {
    return [];
  }

  return [
    {
      value: 'ESCALATED_SEND_BACK',
      label: (
        <AlertsStatusChangeButton
          buttonProps={{
            type: 'TEXT',
          }}
          ids={[alertId]}
          transactionIds={{}}
          onSaved={() => {
            props.onReload();
          }}
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
        />
      ),
    },
  ];
};
export default StatusChangeMenu;
