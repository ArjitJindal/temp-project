import 'rc-picker/assets/index.css';
import PickerPanel from 'rc-picker/es/PickerPanel';
import generateConfig from 'rc-picker/es/generate/dayjs';
import enGbLocale from 'rc-picker/es/locale/en_GB';
import React from 'react';
import { Dayjs } from 'dayjs';
import { Popover } from 'antd';
import cn from 'clsx';
import s from './index.module.less';
import ArrowLeftSIcon from '@/components/ui/icons/Remix/system/arrow-left-s-line.react.svg';
import ArrowRightSIcon from '@/components/ui/icons/Remix/system/arrow-right-s-line.react.svg';
import ArrowRightDoubleIcon from '@/components/ui/icons/remix-v4/arrows/arrow-right-double-line.react.svg';
import ArrowLeftDoubleIcon from '@/components/ui/icons/remix-v4/arrows/arrow-left-double-line.react.svg';
import Button from '@/components/library/Button';
import Tooltip from '@/components/library/Tooltip';

interface Props {
  isVisible: boolean;
  onVisibleChange: (isVisible: boolean) => void;
  children: React.ReactNode;
  value: Dayjs | undefined;
  onChange: (newValue: Dayjs | undefined) => void;
  hideOk?: boolean;
  allowClear?: boolean;
  clearNotAllowedTooltip?: string;
  isDateDisabled?: (value: Dayjs) => boolean;
  isDateInRange?: (value: Dayjs) => {
    inRange: boolean;
    isStart: boolean;
    isEnd: boolean;
  };
}

export default function DateRangeValuePopover(props: Props) {
  const {
    isVisible,
    onVisibleChange,
    children,
    value,
    onChange,
    isDateInRange,
    isDateDisabled,
    allowClear = true,
    clearNotAllowedTooltip,
    hideOk = false,
  } = props;

  const buttonEl = (
    <Button
      size={'SMALL'}
      isDisabled={value == null && allowClear === false}
      onClick={() => {
        onVisibleChange(false);
      }}
    >
      OK
    </Button>
  );
  return (
    <Popover
      trigger={'click'}
      onVisibleChange={onVisibleChange}
      visible={isVisible}
      mouseLeaveDelay={Number.MAX_SAFE_INTEGER}
      content={
        <div className={s.dropdown}>
          <div className={s.panels}>
            <PickerPanel<Dayjs>
              generateConfig={generateConfig}
              locale={enGbLocale}
              picker={'date'}
              // @ts-expect-error Bad types definitions in library
              nextIcon={<ArrowRightSIcon className={s.navButton} />}
              prevIcon={<ArrowLeftSIcon className={s.navButton} />}
              superPrevIcon={<ArrowLeftDoubleIcon className={s.navButton} />}
              superNextIcon={<ArrowRightDoubleIcon className={s.navButton} />}
              value={value}
              onPickerValueChange={onChange}
              dateRender={(value, today) => {
                const {
                  inRange = false,
                  isStart = false,
                  isEnd = false,
                } = isDateInRange?.(value) ?? {};

                return (
                  <div
                    className={cn(s.cell, {
                      [s.isToday]: value.isSame(today, 'day'),
                      [s.inRange]: inRange,
                      [s.isStart]: isStart,
                      [s.isEnd]: isEnd,
                      [s.isDisabled]: isDateDisabled?.(value) ?? false,
                    })}
                  >
                    {value.date()}
                  </div>
                );
              }}
              disabledDate={(toCheck) => {
                return isDateDisabled?.(toCheck) ?? false;
              }}
            />
            <PickerPanel<Dayjs>
              className={s.timePicker}
              generateConfig={generateConfig}
              locale={enGbLocale}
              picker={'time'}
              value={value}
              onPickerValueChange={onChange}
            />
          </div>
          {!hideOk && (
            <div className={s.dropdownFooter}>
              {value == null && allowClear === false && clearNotAllowedTooltip != null ? (
                <Tooltip title={clearNotAllowedTooltip}>
                  <div>{buttonEl}</div>
                </Tooltip>
              ) : (
                buttonEl
              )}
            </div>
          )}
        </div>
      }
    >
      {children}
    </Popover>
  );
}
