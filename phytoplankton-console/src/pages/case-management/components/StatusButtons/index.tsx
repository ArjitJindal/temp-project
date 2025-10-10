import React from 'react';
import s from './style.module.less';
import Dropdown, { DropdownOption } from '@/components/library/Dropdown';
import Button from '@/components/library/Button';
import ArrowDownSLineIcon from '@/components/ui/icons/Remix/system/arrow-down-s-line.react.svg';
import { AllParams } from '@/components/library/Table/types';
import { RuleAction } from '@/apis';
import { TransactionsTableParams } from '@/pages/transactions/components/TransactionsTable';

interface Props {
  params: AllParams<TransactionsTableParams>;
  onChangeParams: (newParams: AllParams<TransactionsTableParams>) => void;
}
export default function StatusButtons(props: Props) {
  const { onChangeParams, params } = props;

  const options = useOptions();
  const value = params.status ?? options[0].value;

  return (
    <div className={s.root}>
      <Dropdown<RuleAction>
        options={options}
        selectedKeys={[value]}
        onSelect={(option) => {
          onChangeParams({
            ...params,
            status: option.value,
          });
        }}
      >
        {options.length > 0 && (
          <Button type="SECONDARY" testName="status-button">
            {options.find((x) => x.value === value)?.label}
            <ArrowDownSLineIcon className={s.arrowIcon} />
          </Button>
        )}
      </Dropdown>
    </div>
  );
}

enum RuleActionToHumanized {
  SUSPEND = 'Suspended',
  ALLOW = 'Approved',
  BLOCK = 'Blocked',
}

function useOptions(): DropdownOption<RuleAction>[] {
  return (['SUSPEND', 'ALLOW', 'BLOCK'] as const).map((status) => ({
    value: status,
    label: RuleActionToHumanized[status],
  }));
}
