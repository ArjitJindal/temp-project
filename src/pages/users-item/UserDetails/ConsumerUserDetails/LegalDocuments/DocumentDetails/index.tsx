import React from 'react';
import s from './index.module.less';

interface Props {
  name: string;
  number: string | undefined;
  children?: React.ReactNode;
}

export default function DocumentDetails(props: Props) {
  const { name, number, children } = props;

  return (
    <>
      <div>
        {<b>{name}</b>}
        <div>{number}</div>
      </div>
      <div className={s.items}>{children}</div>
    </>
  );
}
