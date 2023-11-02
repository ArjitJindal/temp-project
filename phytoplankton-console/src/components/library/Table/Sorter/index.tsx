import React from 'react';
import cn from 'clsx';
import { kebabCase } from 'lodash';
import { SortOrder } from '../types';
import s from './index.module.less';
import ArrowSvg from './arrow.react.svg';

interface Props {
  sorting: false | SortOrder;
  testName?: string;
}

export default function Sorter(props: Props) {
  return (
    <div className={cn(s.root)} data-cy={`${kebabCase(props.testName)}-sorter`}>
      <ArrowSvg className={cn(s.icon, props.sorting === 'ascend' && s.isActive)} />
      <ArrowSvg className={cn(s.icon, s.down, props.sorting === 'descend' && s.isActive)} />
    </div>
  );
}
