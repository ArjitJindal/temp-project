import cn from 'clsx';
import React, { useCallback, useState } from 'react';
import s from './index.module.less';
import DownloadLineIcon from '@/components/ui/icons/Remix/system/download-line.react.svg';
import { download } from '@/utils/browser';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';

export interface Props {
  id: string;
  title: string;
  width?: 'FULL' | 'HALF';
  onDownload?: () => Promise<{
    fileName: string;
    data: string;
  }>;
  extraControls?: React.ReactNode[];
  children: React.ReactNode;
}

export default function Widget(props: Props) {
  const { title, extraControls, onDownload, children, width = 'HALF' } = props;
  const controls = [
    ...(extraControls ?? []),
    ...(onDownload ? [<DownloadButton onDownload={onDownload} />] : []),
  ];
  return (
    <div className={cn(s.root, s[`width-${width}`])}>
      <div className={s.header}>
        <div className={s.title}>{title}</div>
        {controls.length > 0 && (
          <div className={s.controls}>
            {controls.map((control, i) => (
              <React.Fragment key={i}>{control}</React.Fragment>
            ))}
          </div>
        )}
      </div>
      <div className={s.children}>{children}</div>
    </div>
  );
}

function DownloadButton(props: {
  onDownload: () => Promise<{
    fileName: string;
    data: string;
  }>;
}) {
  const { onDownload } = props;
  const [isLoading, setLoading] = useState(false);
  const handleClick = useCallback(() => {
    const hideLoading = message.loading('Downloading file...');
    setLoading(true);
    onDownload()
      .then(
        ({ fileName, data }) => {
          download(fileName, data);
        },
        (e) => {
          message.error(`Unable to download file! ${getErrorMessage(e)}`);
        },
      )
      .finally(() => {
        setLoading(false);
        hideLoading();
      });
  }, [onDownload]);
  return (
    <DownloadLineIcon className={cn(s.icon, isLoading && s.isLoading)} onClick={handleClick} />
  );
}
