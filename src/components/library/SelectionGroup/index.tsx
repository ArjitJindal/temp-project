import React from 'react';
import cn from 'clsx';
import s from './style.module.less';
import { InputProps } from '@/components/library/Form/InputField';
import Checkbox from '@/components/library/Checkbox';
import Radio from '@/components/library/Radio';

interface Option {
  value: string;
  label: string;
  description?: string;
  isDisabled?: boolean;
}

interface CommonProps {
  name?: string; // todo: generalize
  options: Option[];
}

interface MultipleProps extends CommonProps, InputProps<string[]> {
  mode: 'MULTIPLE';
}

interface SingleProps extends CommonProps, InputProps<string> {
  mode: 'SINGLE';
}

type Props = MultipleProps | SingleProps;

export default function SelectionGroup(props: Props) {
  const { mode, options } = props;
  const isSingle = props.mode === 'SINGLE';
  const values: string[] = isSingle ? (props.value ? [props.value] : []) : props.value ?? [];
  return (
    <div className={cn(s.root, mode === 'MULTIPLE' ? s.modeMultiple : s.modeSingle)}>
      {options.map((option) => {
        const isActive = values.includes(option.value);
        return (
          <label
            key={option.value}
            className={cn(s.option, isActive && s.isActive, option.isDisabled && s.isDisabled)}
          >
            <div className={s.top}>
              {isSingle ? (
                <Radio
                  isDisabled={option.isDisabled}
                  value={isActive}
                  onChange={(newValue) => {
                    if (isSingle && newValue) {
                      props.onChange?.(option.value);
                    }
                  }}
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
