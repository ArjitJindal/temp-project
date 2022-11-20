import { Row, Space } from 'antd';
import { PaperClipOutlined, CloseCircleFilled } from '@ant-design/icons';
import filesize from 'filesize';
import COLORS from '../ui/colors';
import s from './styles.module.less';
import { FileInfo } from '@/apis';

interface Props {
  files: FileInfo[];
  showGreyBackground?: boolean;
  removeFile?: (s3Key: string) => void;
  showDeleteButton?: boolean;
}

export const FilesList: React.FC<Props> = ({
  files,
  showGreyBackground,
  removeFile,
  showDeleteButton = false,
}) => {
  return (
    <div className={showGreyBackground ? s.fileListContainer : ''}>
      {files.map((file) => (
        <Row align="middle" key={file.s3Key} className={s.fileAttachmentButton}>
          <Space>
            <PaperClipOutlined style={{ color: COLORS.purpleGray.base }} />
            <a className={`${showGreyBackground ? s.fileListText : ''}`} href={file.downloadLink}>
              {file.filename}
            </a>
            <span className={`${showGreyBackground ? s.fileListText : ''}`}>
              {`(${filesize(file.size)})`}
            </span>
          </Space>
          {showDeleteButton && (
            <button
              className={s.fileListDeleteButton}
              onClick={removeFile && (() => removeFile(file.s3Key))}
            >
              <CloseCircleFilled style={{ color: COLORS.purpleGray.base }} />
            </button>
          )}
        </Row>
      ))}
    </div>
  );
};
