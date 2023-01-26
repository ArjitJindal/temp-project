import { NavLink } from 'react-router-dom';
import React from 'react';
import cn from 'clsx';
import s from './index.module.less';

interface Props {
  items: {
    key: string;
    title: string;
  }[];
  onMakeUrl: (key: string) => string;
}

export default function CategoriesMenu(props: Props) {
  return (
    <div className={s.root}>
      {props.items.map(({ title, key }) => (
        <NavLink
          to={props.onMakeUrl(key)}
          className={({ isActive }) => cn(s.item, isActive && s.isActive)}
          key={key}
        >
          {title}
        </NavLink>
      ))}
    </div>
  );
}
