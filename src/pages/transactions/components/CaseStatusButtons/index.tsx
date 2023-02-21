import React from 'react';
import s from './style.module.less';
import Dropdown from '@/components/library/Dropdown';
import Button from '@/components/library/Button';
import ArrowDownSLineIcon from '@/components/ui/icons/Remix/system/arrow-down-s-line.react.svg';
import { humanizeConstant } from '@/utils/humanize';

interface Props {
  status: 'OPEN' | 'CLOSED';
  onChange: (newStatus: 'OPEN' | 'CLOSED') => void;
}

const STATUSES = ['OPEN', 'CLOSED'] as const;

export default function CaseStatusButtons(props: Props) {
  const { status, onChange } = props;

  const options = STATUSES.map((status) => ({
    value: status,
    label: `${humanizeConstant(status)} cases`,
  }));

  return (
    <div className={s.root}>
      <Dropdown
        options={options}
        onSelect={(option) => {
          onChange(option.value as 'OPEN' | 'CLOSED');
        }}
      >
        <Button type="SECONDARY">
          {options.find(({ value }) => value === status)?.label}
          <ArrowDownSLineIcon className={s.arrowIcon} />
        </Button>
      </Dropdown>
    </div>
  );
}
