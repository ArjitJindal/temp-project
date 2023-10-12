import React from 'react';
import cn from 'clsx';
import { Dropdown as AntDropdown, Menu as AntMenu } from 'antd';
import { Placement } from '@ant-design/pro-form/lib/interface';
import s from './index.module.less';
import ArrowDownFilled from '@/components/ui/icons/Remix/system/arrow-down-s-fill.react.svg';
import ArrowDownLine from '@/components/ui/icons/Remix/system/arrow-down-s-line.react.svg';
import { Permission } from '@/apis';
import { useHasPermissions } from '@/utils/user-utils';

export interface DropdownOption<T extends string | number | boolean = string> {
  value: T;
  label?: string | React.ReactNode;
  isDisabled?: boolean;
}

interface Props<T extends string | number = string> {
  onSelect?: (option: DropdownOption<T>) => void;
  options: DropdownOption<T>[];
  children: React.ReactNode;
  placement?: Placement;
  disabled?: boolean;
  extraBottomMargin?: boolean;
  arrow?: 'FILLED' | 'LINE';
  optionClassName?: string;
  bordered?: boolean;
  minWidth?: number;
  writePermissions?: Permission[];
}

export default function Dropdown<T extends string | number = string>(props: Props<T>): JSX.Element {
  const {
    options,
    children,
    onSelect,
    placement,
    extraBottomMargin,
    disabled,
    arrow,
    optionClassName,
    bordered,
    minWidth,
    writePermissions = [],
  } = props;

  const hasUserPermissions = useHasPermissions(writePermissions);

  const menu = (
    <AntMenu
      onClick={({ key }) => {
        const option = options.find(({ value }) => value === key);
        if (option != null) {
          onSelect?.(option);
        }
      }}
      disabled={!hasUserPermissions}
    >
      {options.map((option) => (
        <AntMenu.Item
          key={option.value.toString()}
          disabled={option.isDisabled}
          className={cn(optionClassName)}
        >
          {option.label ?? option.value}
        </AntMenu.Item>
      ))}
    </AntMenu>
  );

  return (
    <div
      className={cn(s.root, extraBottomMargin && s.extraBottomMargin, bordered && s.bordered)}
      style={{ minWidth }}
    >
      <AntDropdown overlay={menu} trigger={['click']} placement={placement} disabled={disabled}>
        <div className={cn(s.dropdown)}>
          {children}
          {arrow === 'FILLED' && <ArrowDownFilled className={cn(s.arrow)} />}
          {arrow === 'LINE' && <ArrowDownLine className={cn(s.arrow)} />}
        </div>
      </AntDropdown>
    </div>
  );
}
