import React from 'react';
import s from './style.module.less';
import Dropdown from '@/components/library/Dropdown';
import Button from '@/components/library/Button';
import ArrowDownSLineIcon from '@/components/ui/icons/Remix/system/arrow-down-s-line.react.svg';
import { humanizeConstant } from '@/utils/humanize';
import { AlertStatus, CaseStatus } from '@/apis';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

interface Props {
  status?: CaseStatus | AlertStatus;
  onChange: (newStatus: CaseStatus | AlertStatus) => void;
  suffix: 'cases' | 'alerts';
}

export default function StatusButtons(props: Props) {
  const { status, onChange, suffix } = props;

  const escalationEnabled = useFeatureEnabled('ESCALATION');

  const caseStatuses: CaseStatus[] = [
    'OPEN',
    'REOPENED',
    'CLOSED',
    ...(escalationEnabled ? (['ESCALATED'] as const) : []),
  ];
  const options = caseStatuses.map((status) => ({
    value: status,
    label: `${humanizeConstant(status)} ${suffix}`,
  }));

  return (
    <div className={s.root}>
      <Dropdown
        options={options}
        onSelect={(option) => {
          onChange(option.value as CaseStatus | AlertStatus);
        }}
      >
        <Button type="SECONDARY" testName="status-button">
          {options.find(({ value }) => value === status)?.label}
          <ArrowDownSLineIcon className={s.arrowIcon} />
        </Button>
      </Dropdown>
    </div>
  );
}
