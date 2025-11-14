import cn from 'clsx';
import React from 'react';
import { Link } from 'react-router-dom';
import s from './index.module.less';
import { preloadRoute } from '@/utils/routePreload';

export interface SubMenuItem {
  to: string;
  title: string;
}

interface Props {
  items: SubMenuItem[];
}

export default function SubMenu(props: Props) {
  const { items } = props;

  return (
    <div className={cn(s.root)}>
      {items.map((x) => (
        <Link to={x.to} key={x.title} className={s.item} onMouseEnter={() => preloadRoute(x.to)}>
          {x.title}
        </Link>
      ))}
    </div>
  );
}
