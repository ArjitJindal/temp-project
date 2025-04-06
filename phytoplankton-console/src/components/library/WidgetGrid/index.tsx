import cn from 'clsx';
import React from 'react';
import s from './index.module.less';
import ErrorBoundary from '@/components/utils/ErrorBoundary';
import { WidgetProps } from '@/components/library/Widget/types';

interface Props {
  groups: {
    groupTitle: string;
    items: WidgetGroupItem[];
  }[];
}

export type WidgetGroupItem = {
  component?: React.FunctionComponent<WidgetProps>;
  props?: WidgetProps;
  renderComponent?: () => JSX.Element;
};

export default function WidgetGrid(props: Props) {
  const { groups } = props;
  return (
    <div className={cn(s.root)}>
      {groups.map(({ groupTitle, items }, index) =>
        items.length ? (
          <div key={`${groupTitle}-${index}`} className={cn(s.group)}>
            <div className={s.groupTitle}>{groupTitle}</div>
            <div className={s.items}>
              {items.map((item, index) => {
                const Component = item.component;
                return Component ? (
                  <ErrorBoundary key={`${item.props?.id}-${index}`}>
                    <Component key={item.props?.id} {...item.props} />
                  </ErrorBoundary>
                ) : (
                  <ErrorBoundary key={`${item.props?.id}-${index}`}>
                    {item.renderComponent?.()}
                  </ErrorBoundary>
                );
              })}
            </div>
          </div>
        ) : (
          <React.Fragment key={groupTitle} />
        ),
      )}
    </div>
  );
}
