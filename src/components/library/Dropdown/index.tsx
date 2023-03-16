import React from 'react';
import cn from 'clsx';
import { Dropdown as AntDropdown, Menu as AntMenu } from 'antd';
import { Placement } from '@ant-design/pro-form/lib/interface';
import s from './index.module.less';

export interface DropdownOption {
  value: string;
  label?: string | React.ReactNode;
  isDisabled?: boolean;
}

interface Props {
  onSelect?: (option: DropdownOption) => void;
  options: DropdownOption[];
  children: React.ReactNode;
  placement?: Placement;
  disabled?: boolean;
  extraBottomMargin?: boolean;
}

export default function Dropdown(props: Props) {
  const { options, children, onSelect, placement, extraBottomMargin, disabled } = props;

  const menu = (
    <AntMenu
      onClick={({ key }) => {
        const option = options.find(({ value }) => value === key);
        if (option) {
          onSelect?.(option);
        }
      }}
    >
      {options.map((option) => (
        <AntMenu.Item key={option.value} disabled={option.isDisabled}>
          {option.label ?? option.value}
        </AntMenu.Item>
      ))}
    </AntMenu>
  );

  return (
    <div className={cn(s.root, extraBottomMargin && s.extraBottomMargin)}>
      <AntDropdown overlay={menu} trigger={['click']} placement={placement} disabled={disabled}>
        {children}
      </AntDropdown>
    </div>
  );
}
