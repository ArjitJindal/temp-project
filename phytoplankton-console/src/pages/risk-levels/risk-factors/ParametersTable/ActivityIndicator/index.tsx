import React from 'react';
import cn from 'clsx';
import style from './style.module.less';

interface Props {
  isActive: boolean;
}

export default function ActivityIndicator(props: Props) {
  return <div className={cn(style.root, props.isActive && style.isActive)} />;
}
