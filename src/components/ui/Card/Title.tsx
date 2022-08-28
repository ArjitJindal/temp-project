import React from 'react';
import s from './index.module.less';

interface Props {
  children?: string;
}

export default function Title(props: Props) {
  const { children } = props;
  return <h3 className={s.title}>{children}</h3>;
}
