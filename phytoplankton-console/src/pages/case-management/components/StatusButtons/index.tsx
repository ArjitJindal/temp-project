import React from 'react';
import { TableSearchParams } from '../../types';
import s from './style.module.less';
import Dropdown, { DropdownOption } from '@/components/library/Dropdown';
import Button from '@/components/library/Button';
import ArrowDownSLineIcon from '@/components/ui/icons/Remix/system/arrow-down-s-line.react.svg';
import { humanizeConstant } from '@/utils/humanize';
import { AlertStatus, CaseStatus, RuleAction } from '@/apis';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { neverReturn, neverThrow } from '@/utils/lang';
import { AllParams } from '@/components/library/Table/types';

type Entity = 'cases' | 'alerts' | 'transactions';

interface Props {
  params: AllParams<TableSearchParams>;
  onChangeParams: (newParams: AllParams<TableSearchParams>) => void;
}

export default function StatusButtons(props: Props) {
  const { onChangeParams, params } = props;

  const options = useOptions(params);
  const entity = useEntity(params);
  const value =
    entity === 'cases'
      ? params.caseStatus
      : entity === 'alerts'
      ? params.alertStatus
      : params.status?.[0] ?? 'SUSPEND';

  return (
    <div className={s.root}>
      <Dropdown
        options={options}
        onSelect={(option) => {
          if (entity === 'cases') {
            onChangeParams({
              ...params,
              caseStatus: option.value as CaseStatus,
            });
          } else if (entity === 'alerts') {
            onChangeParams({
              ...params,
              alertStatus: option.value as AlertStatus,
            });
          } else if (entity === 'transactions') {
            onChangeParams({
              ...params,
              status: [option.value as RuleAction],
            });
          } else {
            throw neverThrow(entity, `Unknown entity type: ${entity}`);
          }
        }}
      >
        <Button type="SECONDARY" testName="status-button">
          {options.find((x) => x.value === value)?.label}
          <ArrowDownSLineIcon className={s.arrowIcon} />
        </Button>
      </Dropdown>
    </div>
  );
}

function useEntity(params: TableSearchParams): Entity {
  const showCases = params.showCases;
  if (showCases === 'MY' || showCases === 'ALL') {
    return 'cases';
  }
  if (
    showCases === 'ALL_ALERTS' ||
    showCases === 'MY_ALERTS' ||
    showCases == 'QA_UNCHECKED_ALERTS' ||
    showCases == 'QA_FAILED_ALERTS' ||
    showCases == 'QA_PASSED_ALERTS'
  ) {
    return 'alerts';
  }
  if (showCases === 'PAYMENT_APPROVALS') {
    return 'transactions';
  }
  if (showCases == null) {
    return 'cases';
  }
  return neverReturn(showCases, 'cases');
}

function useOptions(params: TableSearchParams): DropdownOption[] {
  const escalationEnabled = useFeatureEnabled('ESCALATION');
  const entity = useEntity(params);

  if (entity === 'alerts' || entity === 'cases') {
    const caseStatuses: (CaseStatus | 'IN_REVIEW' | 'IN_PROGRESS' | 'ON_HOLD')[] = [
      'OPEN',
      'CLOSED',
      ...(escalationEnabled ? (['ESCALATED', 'IN_REVIEW'] as const) : []),
      'IN_PROGRESS',
      'ON_HOLD',
    ];
    return caseStatuses.map((status) => ({
      value: status,
      label: `${humanizeConstant(status)} ${entity}`,
    }));
  }

  if (entity === 'transactions') {
    const statuses: RuleAction[] = ['SUSPEND', 'ALLOW', 'BLOCK'];
    return statuses.map((status) => ({
      value: status,
      label: `${humanizeConstant(status)}ed`,
    }));
  }
  return neverReturn(entity, []);
}
