import React from 'react';
import { Link } from 'react-router-dom';
import style from './style.module.less';
import { message } from '@/components/library/Message';
import FileCopyLineIcon from '@/components/ui/icons/Remix/document/file-copy-line.react.svg';
import { copyTextToClipboard } from '@/utils/browser';
import { getErrorMessage } from '@/utils/lang';

interface Props {
  alwaysShowCopy?: boolean;
  onClick?: () => void;
  to?: string;
  children: string | undefined;
  testName?: string;
  toNewTab?: boolean;
}

export default function Id(props: Props) {
  const { alwaysShowCopy, to, children, testName, onClick, toNewTab = false } = props;

  const handleClickCopy = async (e: React.MouseEvent<unknown>) => {
    e.preventDefault();
    if (children) {
      try {
        await copyTextToClipboard(children);
        message.success('Copied');
      } catch (error) {
        message.error(`Failed to copy: ${getErrorMessage(error)}`);
      }
    }
  };

  if (to != null) {
    return (
      <Link
        className={style.root}
        to={to}
        target={toNewTab ? '_blank' : '_self'}
        title={children}
        data-cy={testName}
      >
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
        target={toNewTab ? '_blank' : '_self'}
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
