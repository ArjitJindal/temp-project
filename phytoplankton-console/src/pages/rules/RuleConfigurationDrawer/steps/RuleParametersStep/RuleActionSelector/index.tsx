import React from 'react';
import cn from 'clsx';
import s from './style.module.less';
import { RuleAction } from '@/apis';
import { RULE_ACTION_OPTIONS } from '@/pages/rules/utils';
import Radio from '@/components/library/Radio';
import { InputProps } from '@/components/library/Form';

const DESCRIPTIONS: { [key in RuleAction]: string } = {
  ALLOW: '',
  FLAG: 'Allow the transaction to continue but mark as FLAGGED. Recommended for AML rules.',
  BLOCK: 'Stop transaction from continuing. Recommended for fraud rules.',
  SUSPEND: 'Put the transaction on hold till investigation is complete.',
};

interface Props extends InputProps<RuleAction> {}

export default function RuleActionSelector(props: Props) {
  const { value, onChange, ...rest } = props;

  return (
    <div className={s.root}>
      {RULE_ACTION_OPTIONS.map((option) => (
        <label key={option.value} className={s.item}>
          <div className={s.radio}>
            <Radio
              value={value === option.value}
              onChange={(checked) => {
                if (checked) {
                  onChange?.(option.value);
                }
              }}
              {...rest}
            />
          </div>
          <div className={s.text}>
            <div className={cn(s.label, s[`color-${option.value}`])}>{option.value}</div>
            <div className={s.description}>{DESCRIPTIONS[option.value]}</div>
          </div>
        </label>
      ))}
    </div>
  );
}
