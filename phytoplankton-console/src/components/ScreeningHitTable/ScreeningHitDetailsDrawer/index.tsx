import React, { useEffect, useState } from 'react';
import { capitalizeWordsInternal } from '@flagright/lib/utils/humanize';
import { LoadingOutlined } from '@ant-design/icons';
import s from './index.module.less';
import { SanctionsEntity } from '@/apis';
import Drawer from '@/components/library/Drawer';
import Button from '@/components/library/Button';
import { CAEntityDetails } from '@/components/SanctionsHitsTable/SearchResultDetailsDrawer';
import { message } from '@/components/library/Message';
import DownloadAsPDF from '@/components/DownloadAsPdf/DownloadAsPDF';
import DownloadLineIcon from '@/components/ui/icons/Remix/system/download-line.react.svg';
import Portal from '@/components/library/Portal';
interface Props {
  hit: SanctionsEntity | null;
  searchedAt?: number;
  onClose: () => void;
}

export default function ScreeningHitDetailsDrawer(props: Props) {
  const { hit, onClose } = props;
  const [pdfRef, setPdfRef] = useState<HTMLDivElement | null>(null);
  const pdfName = capitalizeWordsInternal(hit?.name ?? '');
  const [isDownloading, setDownloading] = useState<boolean>(false);
  const handleDownloadClick = async () => {
    setDownloading(true);
  };
  useEffect(() => {
    async function job() {
      if (isDownloading && pdfRef) {
        try {
          await DownloadAsPDF({ pdfRef, fileName: `${pdfName} Screening Details.pdf` });
        } catch (err) {
          message.fatal(`Unable to complete the download!`, err);
        } finally {
          setDownloading(false);
        }
      }
    }
    job();
  }, [isDownloading, pdfRef, pdfName]);
  const okText = isDownloading ? (
    <>
      <LoadingOutlined className={s.spinner} spin /> Downloading
    </>
  ) : (
    <>
      <DownloadLineIcon className={s.icon} /> Download as PDF
    </>
  );
  return (
    <Drawer
      title={capitalizeWordsInternal(hit?.name ?? '')}
      isVisible={Boolean(hit)}
      onChangeVisibility={(isShown) => {
        if (!isShown) {
          onClose();
        }
      }}
      footer={
        <>
          <Button type="PRIMARY" onClick={handleDownloadClick}>
            {okText}
          </Button>
          <Button type="SECONDARY" onClick={onClose}>
            {'Close'}
          </Button>
        </>
      }
    >
      <div className={s.sections}>
        {hit && <CAEntityDetails pdfMode={false} entity={hit} />}
        {isDownloading && (
          <Portal>
            <div style={{ position: 'fixed', opacity: 0, pointerEvents: 'none' }}>
              <div ref={setPdfRef}>{hit && <CAEntityDetails pdfMode={true} entity={hit} />}</div>
            </div>
          </Portal>
        )}
      </div>
    </Drawer>
  );
}
