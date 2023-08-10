import React from 'react';
import cn from 'clsx';
import { Dropdown as AntDropdown, Menu as AntMenu } from 'antd';
import { Placement } from '@ant-design/pro-form/lib/interface';
import s from './index.module.less';
import ArrowDownFilled from '@/components/ui/icons/Remix/system/arrow-down-s-fill.react.svg';

export interface DropdownOption<T extends string = string> {
  value: T;
  label?: string | React.ReactNode;
  isDisabled?: boolean;
}

interface Props<T extends string = string> {
  onSelect?: (option: DropdownOption) => void;
  options: DropdownOption<T>[];
  children: React.ReactNode;
  placement?: Placement;
  disabled?: boolean;
  extraBottomMargin?: boolean;
  arrow?: boolean;
  optionClassName?: string;
}

export default function Dropdown<T extends string = string>(props: Props<T>): JSX.Element {
  const {
    options,
    children,
    onSelect,
    placement,
    extraBottomMargin,
    disabled,
    arrow,
    optionClassName,
  } = props;

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
        <AntMenu.Item
          key={option.value}
          disabled={option.isDisabled}
          className={cn(optionClassName)}
        >
          {option.label ?? option.value}
        </AntMenu.Item>
      ))}
    </AntMenu>
  );

  return (
    <div className={cn(s.root, extraBottomMargin && s.extraBottomMargin)}>
      <AntDropdown overlay={menu} trigger={['click']} placement={placement} disabled={disabled}>
        <div className={cn(s.dropdown)}>
          {children}
          {arrow && <ArrowDownFilled className={s.arrow} />}
        </div>
      </AntDropdown>
    </div>
  );
}
