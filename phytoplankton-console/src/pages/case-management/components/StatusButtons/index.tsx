import React from 'react';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import { TableSearchParams } from '../../types';
import s from './style.module.less';
import Dropdown, { DropdownOption } from '@/components/library/Dropdown';
import Button from '@/components/library/Button';
import ArrowDownSLineIcon from '@/components/ui/icons/Remix/system/arrow-down-s-line.react.svg';
import { AllParams } from '@/components/library/Table/types';
import { RuleAction } from '@/apis';

interface Props {
  params: AllParams<TableSearchParams>;
  onChangeParams: (newParams: AllParams<TableSearchParams>) => void;
}
export default function StatusButtons(props: Props) {
  const { onChangeParams, params } = props;

  const options = useOptions(params);
  const value = params.status?.[0] ?? 'SUSPEND';

  return (
    <div className={s.root}>
      <Dropdown
        options={options}
        onSelect={(option) => {
          onChangeParams({
            ...params,
            status: [option.value as RuleAction],
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

function useOptions(params: TableSearchParams): DropdownOption[] {
  if (params.showCases !== 'PAYMENT_APPROVALS') {
    return [];
  }
  return ['SUSPEND', 'ALLOW', 'BLOCK'].map((status) => ({
    value: status,
    label: `${humanizeConstant(status)}ed`,
  }));
}
