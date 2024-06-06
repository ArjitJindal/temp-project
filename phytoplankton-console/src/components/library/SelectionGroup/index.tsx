import React from 'react';
import cn from 'clsx';
import s from './style.module.less';
import Checkbox from '@/components/library/Checkbox';
import Radio from '@/components/library/Radio';
import { InputProps } from '@/components/library/Form';

export type SelectionGroupValueType = string | boolean | number | undefined;

export interface Option<Value extends SelectionGroupValueType = SelectionGroupValueType> {
  value: Value;
  label: string;
  description?: string;
  isDisabled?: boolean;
}

interface CommonProps<Value extends SelectionGroupValueType> {
  name?: string; // todo: generalize
  options: Option<Value>[];
  testName?: string;
  optionFixedWidth?: number;
}

interface MultipleProps<Value extends SelectionGroupValueType>
  extends CommonProps<Value>,
    InputProps<Value[]> {
  mode: 'MULTIPLE';
}

interface SingleProps<Value extends SelectionGroupValueType>
  extends CommonProps<Value>,
    InputProps<Value> {
  mode: 'SINGLE';
}

type Props<Value extends SelectionGroupValueType> = MultipleProps<Value> | SingleProps<Value>;

export default function SelectionGroup<
  Value extends SelectionGroupValueType = SelectionGroupValueType,
>(props: Props<Value>) {
  const { mode, options, testName, optionFixedWidth } = props;
  const isSingle = props.mode === 'SINGLE';
  const values: SelectionGroupValueType[] = isSingle
    ? props.value
      ? [props.value]
      : []
    : props.value ?? [];

  return (
    <div className={cn(s.root, mode === 'MULTIPLE' ? s.modeMultiple : s.modeSingle)}>
      {options.map((option) => {
        const isActive = values.includes(option.value);
        return (
          <label
            key={String(option.value)}
            className={cn(s.option, isActive && s.isActive, option.isDisabled && s.isDisabled)}
            style={optionFixedWidth ? { width: optionFixedWidth, maxWidth: 'unset' } : undefined}
          >
            <div className={s.top}>
              {isSingle ? (
                <Radio
                  isDisabled={option.isDisabled}
                  value={JSON.stringify(option.value) === JSON.stringify(props.value)}
                  onChange={(newValue) => {
                    if (isSingle && newValue) {
                      props.onChange?.(option.value);
                    }
                  }}
                  testName={testName}
                />
              ) : (
                <Checkbox
                  isDisabled={option.isDisabled}
                  value={isActive}
                  onChange={(checked) => {
                    if (!isSingle) {
                      props.onChange?.([
                        ...(props.value ?? []).filter((x) => x !== option.value),
                        ...(checked ? [option.value] : []),
                      ]);
                    }
                  }}
                  testName={testName}
                />
              )}
              <div className={s.label}>{option.label}</div>
            </div>
            {option.description && <div className={s.description}>{option.description}</div>}
          </label>
        );
      })}
    </div>
  );
}
