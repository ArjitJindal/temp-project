import React from 'react';
import { ButtonProps } from 'antd/es/button/button';
import { Link } from 'react-router-dom';
import { message } from 'antd';
import style from './style.module.less';
import { copyTextToClipboard } from '@/utils/browser';

interface ExtraProps {
  to?: string;
  children?: string;
}

export default function Id(props: ButtonProps & ExtraProps) {
  const { to, children } = props;

  if (to != null) {
    return (
      <Link className={style.root} to={to} title={children}>
        {children}
      </Link>
    );
  }
  return (
    <a
      className={style.root}
      href="#"
      title={children}
      onClick={(e) => {
        e.preventDefault();
        // todo: i18n
        if (children) {
          copyTextToClipboard(children)
            .then(() => {
              message.success('Copied to clipboard');
            })
            .catch((e) => {
              message.warn(`Unable copy to clipboard; ${e.message ?? 'Unknown error'}`);
            });
        }
      }}
    >
      {children}
    </a>
  );
}
