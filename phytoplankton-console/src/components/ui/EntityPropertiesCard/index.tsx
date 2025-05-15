import React from 'react';
import s from './index.module.less';

interface Item {
  label: React.ReactNode;
  value?: React.ReactNode;
}

interface Props {
  title?: string;
  extraControls?: React.ReactNode;
  items?: Item[];
  columns?: number;
  children?: React.ReactNode;
  columnTemplate?: string;
  modal?: React.ReactNode;
}

export default function EntityPropertiesCard(props: Props) {
  const { title, extraControls, items, columns = 1, children, columnTemplate, modal } = props;
  return (
    <div className={s.root}>
      <div className={s.header}>
        {title && <div className={s.title}>{title}</div>}
        {extraControls}
      </div>
      {
        <>
          {items && (
            <div
              className={s.items}
              style={{ gridTemplateColumns: columnTemplate || `repeat(${columns * 2}, auto)` }}
            >
              {items.map(({ label, value }, index) => (
                <React.Fragment key={index}>
                  <div className={s.itemLabel}>{label}</div>
                  <div className={s.itemValue}>{value ?? '-'}</div>
                </React.Fragment>
              ))}
            </div>
          )}
        </>
      }
      {children}
      {modal}
    </div>
  );
}
