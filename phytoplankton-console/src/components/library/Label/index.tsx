import React from 'react';
import cn from 'clsx';
import s from './style.module.less';
import { InputProps } from '@/components/library/Form';

export interface Props extends InputProps<string> {
  label: React.ReactNode;
  children?: React.ReactNode;
  position?: 'TOP' | 'RIGHT' | 'LEFT';
  level?: 1 | 2 | 3 | 4;
  description?: string;
  element?: 'label' | 'div';
  required?:
    | {
        value: boolean;
        showHint: boolean;
      }
    | boolean;
  testId?: string;
}

export default function Label(props: Props) {
  const {
    label,
    position = 'TOP',
    level = 1,
    children,
    description,
    element = 'div',
    required = {
      value: false,
      showHint: false,
    },
    testId,
  } = props;
  const isRequired = (typeof required === 'boolean' ? required : required?.value) === true;
  const showHint = (typeof required === 'boolean' ? required : required?.showHint) === true;
  const labelEl = (
    <div className={cn(s.label, s[`level-${level}`])}>
      {label}
      {showHint &&
        (isRequired ? (
          <span className={s.required}> *</span>
        ) : (
          <>
            {' - '}
            <span className={s.optional}>Optional</span>
          </>
        ))}
    </div>
  );
  const descriptionEl = description && <div className={s.description}>{description}</div>;
  return React.createElement(
    element,
    {
      className: cn(s.root, s[`position-${position}`], s[`level-${level}`]),
      ['data-cy']: testId,
    },
    position === 'TOP' ? (
      <>
        <div className={s.labelDescription}>
          {labelEl}
          {descriptionEl}
        </div>
        {children}
      </>
    ) : (
      <>
        <div className={s.row}>
          {position === 'RIGHT' ? (
            <>
              {children}
              {labelEl}
            </>
          ) : (
            <>
              {labelEl}
              {children}
            </>
          )}
        </div>
        {descriptionEl}
      </>
    ),
  );
}
