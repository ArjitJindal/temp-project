import React from 'react';
import cn from 'clsx';
import { Dropdown as AntDropdown, Menu as AntMenu } from 'antd';
import { Resource } from '@flagright/lib/utils';
import s from './index.module.less';
import ArrowDownFilled from '@/components/ui/icons/Remix/system/arrow-down-s-fill.react.svg';
import ArrowDownLine from '@/components/ui/icons/Remix/system/arrow-down-s-line.react.svg';
import { useHasResources } from '@/utils/user-utils';

export interface DropdownOption<T extends string | number | boolean = string> {
  value: T;
  label?: string | React.ReactNode;
  isDisabled?: boolean;
}

type Placement =
  | 'topLeft'
  | 'topCenter'
  | 'topRight'
  | 'bottomLeft'
  | 'bottomCenter'
  | 'bottomRight';

interface Props<T extends string | number = string> {
  onSelect?: (option: DropdownOption<T>) => void;
  selectedKeys?: string[];
  options: DropdownOption<T>[];
  children: React.ReactNode;
  placement?: Placement;
  disabled?: boolean;
  extraBottomMargin?: boolean;
  arrow?: 'FILLED' | 'LINE';
  optionClassName?: string;
  bordered?: boolean;
  minWidth?: number;
  writeResources?: Resource[];
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
    writeResources = [],
    selectedKeys = [],
  } = props;

  const hasUserPermissions = useHasResources(writeResources);

  const isDisabled = !hasUserPermissions || disabled;
  const menu = (
    <AntMenu
      onClick={({ key }) => {
        const option = options.find(({ value }) => value === key);
        if (option != null) {
          onSelect?.(option);
        }
      }}
      selectedKeys={selectedKeys}
      disabled={isDisabled}
      items={options.map((option) => ({
        key: option.value.toString(),
        disabled: option.isDisabled,
        className: cn(optionClassName),
        label: option.label ?? option.value,
      }))}
    />
  );

  return (
    <div
      className={cn(
        s.root,
        extraBottomMargin && s.extraBottomMargin,
        bordered && s.bordered,
        isDisabled && s.isDisabled,
      )}
      style={{ minWidth }}
    >
      <AntDropdown overlay={menu} trigger={['click']} placement={placement} disabled={disabled}>
        <div className={cn(s.dropdown, disabled && s.isDisabled)}>
          {children}
          {arrow === 'FILLED' && <ArrowDownFilled className={cn(s.arrow)} />}
          {arrow === 'LINE' && <ArrowDownLine className={cn(s.arrow)} />}
        </div>
      </AntDropdown>
    </div>
  );
}
