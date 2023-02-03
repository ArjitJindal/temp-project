import React from 'react';
import cn from 'clsx';
import s from './style.module.less';
import { InputProps } from '@/components/library/Form';

export interface Props extends InputProps<string> {
  label: string;
  children: React.ReactNode;
  position?: 'TOP' | 'RIGHT';
  level?: 1 | 2 | 3;
  description?: string;
  element?: 'label' | 'div';
  isOptional?: boolean;
}

export default function Label(props: Props) {
  const {
    label,
    position = 'TOP',
    level = 1,
    children,
    description,
    element = 'label',
    isOptional = false,
  } = props;
  const labelEl = (
    <div className={cn(s.label, s[`level-${level}`])}>
      {label}
      {isOptional && (
        <>
          {' - '}
          <span className={s.optional}>Optional</span>
        </>
      )}
    </div>
  );
  const descriptionEl = description && <div className={s.description}>{description}</div>;

  return React.createElement(
    element,
    {
      className: cn(s.root, s[`position-${position}`], s[`level-${level}`]),
    },
    position === 'RIGHT' ? (
      <>
        <div className={s.row}>
          {children}
          {labelEl}
        </div>
        {descriptionEl}
      </>
    ) : (
      <>
        <div className={s.labelDescription}>
          {labelEl}
          {descriptionEl}
        </div>
        {children}
      </>
    ),
  );
}
