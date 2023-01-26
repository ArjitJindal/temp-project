import React, { Dispatch, SetStateAction, useState } from 'react';
import s from './index.module.less';

interface Props {
  title: string;
  description?: string;
  children:
    | React.ReactNode
    | ((
        state: [Record<string, any>, Dispatch<SetStateAction<Record<string, any>>>],
      ) => React.ReactNode);
}

export default function UseCase(props: Props) {
  const state = useState<Record<string, any>>({});
  const { children, title, description } = props;
  return (
    <div className={s.root}>
      <div className={s.header}>
        <div className={s.title}>{title}</div>
      </div>
      <div className={s.content}>
        <div className={s.children}>
          {typeof children === 'function' ? children(state) : children}
        </div>
      </div>
      {description && <div className={s.description}>{description}</div>}
    </div>
  );
}
