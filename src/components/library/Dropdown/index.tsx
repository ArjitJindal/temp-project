import React from 'react';
import cn from 'clsx';
import { Dropdown as AntDropdown, Menu as AntMenu } from 'antd';
import s from './index.module.less';

export interface DropdownOption {
  value: string;
  label?: string;
  isDisabled?: boolean;
}

interface Props {
  onSelect?: (option: DropdownOption) => void;
  options: DropdownOption[];
  children: React.ReactNode;
}

export default function Dropdown(props: Props) {
  const { options, children, onSelect } = props;

  const menu = (
    <AntMenu
      onClick={({ key }) => {
        const option = options.find(({ value }) => value === key);
        if (option) {
          onSelect?.(option);
        }
      }}
      items={options.map((option) => ({ key: option.value, label: option.label }))}
    />
  );

  return (
    <div className={cn(s.root)}>
      <AntDropdown overlay={menu} trigger={['click']}>
        {children}
      </AntDropdown>
    </div>
  );
}
