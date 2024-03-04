import React from 'react';
import JSZip from 'jszip';
import DownloadIcon from '@/components/ui/icons/Remix/system/download-2-line.react.svg';
import Button from '@/components/library/Button';
import { FileInfo } from '@/apis';
import { message } from '@/components/library/Message';
import { downloadLink } from '@/utils/download-link';

interface Props {
  files: Array<FileInfo | undefined>;
  downloadFilename?: string;
}

export default function DownloadFilesButton(props: Props) {
  const { files, downloadFilename = 'Attachments' } = props;
  async function handleDownloadButtonClick(files: Array<FileInfo | undefined>) {
    const hideMessage = message.loading('Downloading attachments');
    try {
      const zipBlob = await createZipFile(files);
      const url = window.URL.createObjectURL(zipBlob);
      downloadLink(url, `${downloadFilename}.zip`);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      message.error('Unable to complete the download');
    } finally {
      hideMessage && hideMessage();
    }
  }
  return files.length ? (
    <Button
      key={'download-all'}
      icon={<DownloadIcon />}
      onClick={() => {
        handleDownloadButtonClick(files);
      }}
      type="TETRIARY"
      testName="download-all-button"
    >
      Download all attachments
    </Button>
  ) : (
    <></>
  );
}

export async function createZipFile(files: Array<FileInfo | undefined>) {
  const zip = new JSZip();
  const fetchPromises: Promise<JSZip>[] = [];

  for (let i = 0; i < files.length; i++) {
    const downloadLink = files[i]?.downloadLink || '';
    const filename = files[i]?.filename || `attachment${i + 1}`;

    fetchPromises.push(
      fetch(downloadLink)
        .then((response) => response.blob())
        .then((blob) => zip.file(filename, blob)),
    );
  }
  await Promise.all(fetchPromises);

  const content = await zip.generateAsync({ type: 'blob' });

  return content;
}
