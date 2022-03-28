import { UploadOutlined, LoadingOutlined } from '@ant-design/icons';
import { useAuth0 } from '@auth0/auth0-react';
import { Button, Dropdown, Menu, message, Upload } from 'antd';
import axios from 'axios';
import { useState } from 'react';
import { ImportRequestFormatEnum, ImportRequestTypeEnum } from '@/apis';
import { useApi } from '@/api';

// TODO: Use server-provided feature flag
const CUSTOM_FORMAT_TENANTS = ['sh-payment'];

interface FileImportProps {
  type: ImportRequestTypeEnum;
  format: ImportRequestFormatEnum;
  onStart: () => void;
  onEnd: () => void;
}

const FileImport: React.FC<FileImportProps> = ({ type, format, onStart, onEnd, children }) => {
  const api = useApi();
  return (
    <Upload
      accept=".csv"
      key="import"
      showUploadList={false}
      customRequest={async ({ file, filename }) => {
        onStart();
        let hideMessage = message.loading('Uploading...', 0);
        try {
          // 1. Get S3 presigned URL
          const { presignedUrl, s3Key } = await api.postGetPresignedUrl({});

          // 2. Upload file to S3 directly
          await axios.put(presignedUrl, file, {
            headers: {
              'Content-Disposition': `attachment; filename="${filename}"`,
            },
          });
          hideMessage();

          // 3. Start importing
          hideMessage = message.loading('Importing...', 0);

          const { importedCount } = await api.postImport({
            ImportRequest: {
              type,
              format,
              s3Key,
            },
          });
          message.success(`Imported ${importedCount} ${type.toLowerCase()} records`);
        } catch (error) {
          message.error(error as any);
        } finally {
          hideMessage && hideMessage();
          onEnd();
        }
      }}
    >
      {children}
    </Upload>
  );
};

interface FileImportButtonProps {
  type: ImportRequestTypeEnum;
}
export const FileImportButton: React.FC<FileImportButtonProps> = ({ type }) => {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth0();
  const isCustomFormatSupported =
    user && CUSTOM_FORMAT_TENANTS.includes(user['https://flagright.com/tenantName']);

  const menu = (
    <Menu>
      <Menu.Item key="flagright">
        <FileImport
          type={type}
          format="flagright"
          onStart={() => setLoading(true)}
          onEnd={() => setLoading(false)}
        >
          Flagright format
        </FileImport>
      </Menu.Item>
      {isCustomFormatSupported && (
        <Menu.Item key="custom">
          <FileImport
            type={type}
            format="custom"
            onStart={() => setLoading(true)}
            onEnd={() => setLoading(false)}
          >
            Custom format
          </FileImport>
        </Menu.Item>
      )}
    </Menu>
  );

  return (
    <Dropdown overlay={menu} disabled={loading} placement="bottomRight">
      <Button>
        {loading ? <LoadingOutlined /> : <UploadOutlined />}
        Import
      </Button>
    </Dropdown>
  );
};
