import React from 'react';
import cn from 'clsx';
import _ from 'lodash';
import { SortOrder } from '../types';
import s from './index.module.less';
import ArrowSvg from './arrow.react.svg';

interface Props {
  sorting: false | SortOrder;
  testName?: string;
}

export default function Sorter(props: Props) {
  return (
    <div className={cn(s.root)} data-cy={`${_.kebabCase(props.testName)}-sorter`}>
      <ArrowSvg className={cn(s.icon, props.sorting === 'ascend' && s.isActive)} />
      <ArrowSvg className={cn(s.icon, s.down, props.sorting === 'descend' && s.isActive)} />
    </div>
  );
}
