import React from 'react';
import cn from 'clsx';
import { Link } from 'react-router-dom';
import s from './index.module.less';
import ArrowRightSLineIcon from '@/components/ui/icons/Remix/system/arrow-right-s-line.react.svg';
import { AsyncResource, isAsyncResource, success } from '@/utils/asyncResource';
import Skeleton from '@/components/library/Skeleton';

export interface BreadcrumbItem {
  title: string;
  to?: string;
  onClick?: () => void;
}

interface Props {
  items: (BreadcrumbItem | AsyncResource<BreadcrumbItem>)[];
}

export default function Breadcrumbs(props: Props) {
  const { items } = props;

  return (
    <div className={cn(s.root)}>
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i !== 0 && <ArrowRightSLineIcon className={s.arrowIcon} />}
          <Skeleton res={isAsyncResource(item) ? item : success(item)}>
            {(x) =>
              React.createElement(
                x.to == null ? 'span' : Link,
                {
                  className: cn(s.link, i === items.length - 1 && s.isLast),
                  to: x.to ?? '',
                  id: 'breadcrumb-link',
                  onClick: x.onClick,
                },
                x.title,
              )
            }
          </Skeleton>
        </React.Fragment>
      ))}
    </div>
  );
}
