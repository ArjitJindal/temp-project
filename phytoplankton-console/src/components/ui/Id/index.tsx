import React from 'react';
import { Link } from 'react-router-dom';
import style from './style.module.less';
import { message } from '@/components/library/Message';
import FileCopyLineIcon from '@/components/ui/icons/Remix/document/file-copy-line.react.svg';
import { copyTextToClipboard } from '@/utils/browser';

interface Props {
  alwaysShowCopy?: boolean;
  onClick?: () => void;
  to?: string;
  children: string | undefined;
  testName?: string;
}

export default function Id(props: Props) {
  const { alwaysShowCopy, to, children, testName, onClick } = props;

  const handleClickCopy = (e: React.MouseEvent<unknown>) => {
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
  };

  if (to != null) {
    return (
      <Link className={style.root} to={to} title={children} data-cy={testName}>
        {children}
        {alwaysShowCopy && <FileCopyLineIcon className={style.icon} onClick={handleClickCopy} />}
      </Link>
    );
  }

  if (children != null) {
    return (
      <a
        className={style.root}
        href="#"
        title={children}
        onClick={onClick || handleClickCopy}
        data-cy={testName}
      >
        <div className={style.inner}>
          <span className={style.id}>{children}</span>
          {alwaysShowCopy && <FileCopyLineIcon className={style.icon} />}
        </div>
      </a>
    );
  }

  return <>-</>;
}
