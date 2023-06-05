import { useState, useEffect } from 'react';
import { LoadingOutlined } from '@ant-design/icons';
import DownloadAsPDF from '../DownloadAsPDF';
import s from './style.module.less';
import Button from '@/components/library/Button';
import DownloadLineIcon from '@/components/ui/icons/Remix/system/download-line.react.svg';
import { message } from '@/components/library/Message';

interface Props {
  onClose: () => void;
  closeText?: string | 'Close';
  pdfRef: React.MutableRefObject<HTMLInputElement>;
  pdfName?: string;
}

export default function SearchResultDetailsModalFooter(props: Props) {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { onClose, closeText = 'Close', pdfRef, pdfName } = props;
  const handleDownloadClick = (): void => {
    setIsLoading(true);
    DownloadAsPDF(pdfRef, pdfName)
      .then(() => setIsLoading(false))
      .catch((err) => {
        message.fatal(`Unable to complete the download!`, err);
      });
  };
  useEffect(() => {
    const selectedElement = document.querySelector('.ant-modal-footer');
    if (selectedElement) {
      selectedElement.classList.add(s.sticky_footer);
    }
  }, []);
  return (
    <div className={s.footer}>
      <div className={s.footerButtons}>
        <Button type="TETRIARY" onClick={onClose}>
          {closeText}
        </Button>
        <Button type="PRIMARY" onClick={handleDownloadClick}>
          {isLoading ? (
            <>
              {' '}
              <LoadingOutlined className={s.spinner} spin /> Downloding{' '}
            </>
          ) : (
            <>
              <DownloadLineIcon className={s.icon} /> Download as PDF
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
