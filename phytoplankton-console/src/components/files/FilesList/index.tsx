import { PaperClipOutlined } from '@ant-design/icons';
import filesize from 'filesize';
import cn from 'clsx';
import DeleteIcon from './delete-icon.react.svg';
import s from './styles.module.less';
import COLORS from '@/components/ui/colors';
import { FileInfo } from '@/apis';

interface Props {
  files: FileInfo[];
  onDeleteFile?: (s3Key: string) => void;
  fixedHeight?: boolean;
}

export default function FilesList(props: Props) {
  const { files, onDeleteFile, fixedHeight = false } = props;
  if (files.length === 0) {
    return <></>;
  }
  return (
    <div className={cn(s.fileList, fixedHeight && s.fileListContainerFixedHeight)}>
      {files.map((file) => (
        <div key={file.s3Key} className={s.fileAttachmentButton} data-cy="attached-file">
          <div className={s.section}>
            <PaperClipOutlined style={{ color: COLORS.purpleGray.base }} />
            <a href={file.downloadLink}>{file.filename}</a>
            <span className={s.size}>{`(${filesize(file.size)})`}</span>
          </div>
          {onDeleteFile != null && (
            <button className={s.fileListDeleteButton} onClick={() => onDeleteFile(file.s3Key)}>
              <DeleteIcon />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
