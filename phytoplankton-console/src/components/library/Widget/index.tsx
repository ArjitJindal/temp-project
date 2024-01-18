import cn from 'clsx';
import React, { MutableRefObject, useCallback, useState } from 'react';
import s from './index.module.less';
import { WidgetProps } from './types';
import WidgetBase from './WidgetBase';
import DownloadLineIcon from '@/components/ui/icons/Remix/system/download-line.react.svg';
import { download } from '@/utils/browser';
import { message } from '@/components/library/Message';
import DownloadAsPDF from '@/components/SanctionsTable/SearchResultDetailsModal/DownloadAsPDF';

const DEFAULT_FIXED_HEIGHT = 400;

function Widget(props: WidgetProps, ref: React.Ref<HTMLInputElement>) {
  const { id, title, extraControls, onDownload, children, width, resizing = 'AUTO' } = props;
  const controls = [
    ...(extraControls ?? []),
    ...(onDownload ? [<DownloadButton onDownload={onDownload} />] : []),
  ];

  return (
    <WidgetBase ref={ref} width={width} id={id}>
      <div
        className={cn(s.root, resizing === 'FIXED' && s.fixedHeight)}
        style={{
          minHeight: resizing === 'AUTO' ? undefined : DEFAULT_FIXED_HEIGHT,
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
          <div
            className={s.children}
            style={{ overflow: resizing === 'AUTO' ? undefined : 'auto' }}
          >
            {children}
          </div>
        </div>
      </div>
    </WidgetBase>
  );
}

export default React.forwardRef(Widget);

export function DownloadButton(props: {
  onDownload: () => Promise<{
    fileName: string;
    data?: string;
    pdfRef?: MutableRefObject<HTMLInputElement>;
    tableTitle?: string;
  }>;
}) {
  const { onDownload } = props;
  const [isLoading, setLoading] = useState(false);
  const handleClick = useCallback(async () => {
    const hideMessage = message.loading('Downloading file...');
    setLoading(true);

    try {
      const { data, fileName, pdfRef, tableTitle } = await onDownload();
      if (pdfRef) {
        await DownloadAsPDF({ pdfRef, fileName, data, tableTitle });
      } else {
        if (data && data.length) {
          download(fileName, data);
        } else {
          message.info('Nothing to download');
        }
      }
    } catch (err) {
      message.fatal('Unable to complete the download!', err);
    } finally {
      setLoading(false);
      hideMessage && hideMessage();
      message.success('File successfully downloaded');
    }
  }, [onDownload]);
  return (
    <DownloadLineIcon className={cn(s.icon, isLoading && s.isLoading)} onClick={handleClick} />
  );
}
