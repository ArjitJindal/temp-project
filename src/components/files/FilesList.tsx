import { Row, Space } from 'antd';
import { PaperClipOutlined } from '@ant-design/icons';
import filesize from 'filesize';
import { FileInfo } from '@/apis';

interface Props {
  files: FileInfo[];
}

export const FilesList: React.FC<Props> = ({ files }) => {
  return (
    <div>
      {files.map((file) => (
        <Row align="middle" key={file.s3Key}>
          <Space>
            <PaperClipOutlined />
            <a href={file.downloadLink}>{file.filename}</a>
            {`(${filesize(file.size)})`}
          </Space>
        </Row>
      ))}
    </div>
  );
};
