import React from 'react';
import cn from 'clsx';
import s from './style.module.less';
import SameWidthDiv from '@/components/library/SameWidthDiv';

interface Props {
  items: {
    key: string;
    icon?: React.ReactNode;
    title: string;
    isInvalid?: boolean;
  }[];
  active: string;
  onChange: (key: string) => void;
  children?: React.ReactNode;
  minWidth?: number;
  additionalMenuTop?: React.ReactNode;
  testId?: string;
}

export default function VerticalMenu(props: Props) {
  const { active, items, children, minWidth, onChange, testId = 'vertical-menu' } = props;
  return (
    <div className={s.root} data-cy={testId}>
      {(items.length > 0 || props.additionalMenuTop) && (
        <div className={s.items} style={{ minWidth }}>
          {props.additionalMenuTop}
          {items.map((item) => (
            <div
              data-cy={`${testId}-item`}
              key={item.key}
              className={cn(
                s.item,
                active === item.key && s.isActive,
                item.isInvalid && s.isInvalid,
              )}
              onClick={() => onChange(item.key)}
            >
              {item.icon && <div className={s.icon}>{item.icon}</div>}
              <SameWidthDiv className={s.title} title={item.title}>
                {item.title}
              </SameWidthDiv>
            </div>
          ))}
        </div>
      )}
      {children && <div className={s.children}>{children}</div>}
    </div>
  );
}
