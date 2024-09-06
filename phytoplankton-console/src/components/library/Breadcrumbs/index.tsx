import React from 'react';
import cn from 'clsx';
import { Link } from 'react-router-dom';
import s from './index.module.less';
import ArrowRightSLineIcon from '@/components/ui/icons/Remix/system/arrow-right-s-line.react.svg';

export interface BreadcrumbItem {
  title: string;
  to?: string;
}

interface Props {
  items: BreadcrumbItem[];
}

export default function Breadcrumbs(props: Props) {
  const { items } = props;

  return (
    <div className={cn(s.root)}>
      {items.map((x, i) => {
        return (
          <React.Fragment key={i}>
            {i !== 0 && <ArrowRightSLineIcon className={s.arrowIcon} />}
            {React.createElement(
              x.to == null ? 'span' : Link,
              {
                className: cn(s.link, i === items.length - 1 && s.isLast),
                to: x.to ?? '',
                id: 'breadcrumb-link',
              },
              x.title,
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
