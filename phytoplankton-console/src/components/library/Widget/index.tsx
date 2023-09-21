import cn from 'clsx';
import React, { useCallback, useState } from 'react';
import s from './index.module.less';
import { WidgetProps } from './types';
import WidgetBase from './WidgetBase';
import DownloadLineIcon from '@/components/ui/icons/Remix/system/download-line.react.svg';
import { download } from '@/utils/browser';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';

const DEFAULT_FIXED_HEIGHT = 400;

export default function Widget(props: WidgetProps) {
  const { title, extraControls, onDownload, children, width, resizing = 'AUTO' } = props;
  const controls = [
    ...(extraControls ?? []),
    ...(onDownload ? [<DownloadButton onDownload={onDownload} />] : []),
  ];

  return (
    <WidgetBase width={width}>
      <div
        className={cn(s.root, resizing === 'FIXED' && s.fixedHeight)}
        style={{
          height: resizing === 'AUTO' ? undefined : DEFAULT_FIXED_HEIGHT,
        }}
      >
        <div className={s.header}>
          {title && <div className={s.title}>{title}</div>}
          {controls.length > 0 && (
            <div className={s.controls}>
              {controls.map((control, i) => (
                <React.Fragment key={i}>{control}</React.Fragment>
              ))}
            </div>
          )}
        </div>
        <div className={s.childrenWrapper}>
          <div className={s.children}>{children}</div>
        </div>
      </div>
    </WidgetBase>
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
