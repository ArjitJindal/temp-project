import { NavLink, useMatch } from 'react-router-dom';
import React from 'react';
import cn from 'clsx';
import { CATEGORY_ROUTE, COMPONENT_ROUTE } from '../routes';
import s from './index.module.less';
import { Category } from '@/pages/storybook/types';
import { makeUrl } from '@/utils/routing';

interface Props {
  items: Category[];
}

function SectionMenu(props: Props) {
  const categoryMatch = useMatch(CATEGORY_ROUTE);
  const componentMatch = useMatch(COMPONENT_ROUTE);
  const match = componentMatch ?? categoryMatch;
  const category = props.items.find((x) => x.key === match?.params?.category);
  return (
    <div className={s.list}>
      {category?.components?.map((component) => (
        <NavLink
          to={makeUrl(COMPONENT_ROUTE, {
            category: category?.key,
            component: component.key,
          })}
          className={({ isActive }) => cn(s.item, isActive && s.isActive)}
          key={component.key}
        >
          {component.key}
        </NavLink>
      ))}
    </div>
  );
}

export default function CategoriesMenu(props: Props) {
  return (
    <div className={s.root}>
      <div className={s.list}>
        {props.items.map((category) => (
          <NavLink
            to={makeUrl(CATEGORY_ROUTE, { category: category.key })}
            className={({ isActive }) => cn(s.item, isActive && s.isActive)}
            key={category.key}
          >
            {category.title}
          </NavLink>
        ))}
      </div>
      <SectionMenu {...props} />
    </div>
  );
}
