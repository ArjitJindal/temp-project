import cn from 'clsx';
import React, { MutableRefObject, useCallback, useState } from 'react';
import s from './index.module.less';
import { WidgetProps } from './types';
import WidgetBase from './WidgetBase';
import DownloadLineIcon from '@/components/ui/icons/Remix/system/download-line.react.svg';
import { download } from '@/utils/browser';
import { message } from '@/components/library/Message';
import DownloadAsPDF, {
  FONT_FAMILY_SEMIBOLD,
  TableOptions,
  getTableHeadAndBody,
} from '@/components/DownloadAsPdf/DownloadAsPDF';

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
      if (pdfRef?.current) {
        const tableOptions = buildDownloadableTable(data);
        await DownloadAsPDF({
          pdfRef: pdfRef.current,
          fileName,
          tableOptions: tableOptions ? [tableOptions] : [],
          reportTitle: tableTitle,
        });
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

function buildDownloadableTable(data?: string): TableOptions | undefined {
  const tableData = getTableHeadAndBody(data);
  if (!tableData) {
    return undefined;
  }
  return {
    tableOptions: {
      head: [tableData.head],
      body: tableData.rows,
      headStyles: {
        fillColor: [245, 245, 245],
        textColor: [38, 38, 38],
        font: FONT_FAMILY_SEMIBOLD,
      },
      alternateRowStyles: { fillColor: [255, 255, 255] },
      bodyStyles: { fillColor: [250, 250, 250] },
      didParseCell: (data) => {
        switch (data.cell.text[0]) {
          case 'VERY_HIGH': {
            data.cell.styles.textColor = [245, 34, 45];
            break;
          }
          case 'HIGH': {
            data.cell.styles.textColor = [250, 140, 22];
            break;
          }
          case 'MEDIUM': {
            data.cell.styles.textColor = [245, 226, 90];
            break;
          }
          case 'LOW': {
            data.cell.styles.textColor = [82, 196, 26];
            break;
          }
          case 'VERY_LOW': {
            data.cell.styles.textColor = [173, 198, 255];
            break;
          }
        }
      },
    },
  };
}
