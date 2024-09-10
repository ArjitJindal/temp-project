import { InboxOutlined, LoadingOutlined, UploadOutlined } from '@ant-design/icons';
import { Alert, Divider, Select } from 'antd';
import { useCallback, useState } from 'react';
import Dragger from 'antd/es/upload/Dragger';
import filesize from 'filesize';
import { last, range } from 'lodash';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import { message } from '@/components/library/Message';
import Button from '@/components/library/Button';
import { FileInfo, ImportRequestFormatEnum, ImportRequestTypeEnum, Permission } from '@/apis';
import { useApi } from '@/api';
import { sleep } from '@/utils/time-utils';
import { useAuth0User } from '@/utils/user-utils';
import { uploadFile } from '@/utils/file-uploader';
import Modal from '@/components/library/Modal';

const EXAMPLE_FILE_URL: Record<ImportRequestTypeEnum, string> = {
  TRANSACTION:
    'https://docs.google.com/spreadsheets/d/1DoL-vcAJ4zEMocUi7AnNq9iLhTe2LkyDftZbrhy9zzg',
  USER: 'https://docs.google.com/spreadsheets/d/1RdfWy3d_maOor16VIGoiXeKsu-kWIDfWmzygGxYdzPA',
  BUSINESS: 'https://docs.google.com/spreadsheets/d/1hwA5BN2bVAx4Um4l-5extyBqluT3PPS6lN3_hk2zqv8',
};
const OPENAPI_REF: Record<ImportRequestTypeEnum, string> = {
  TRANSACTION: 'https://docs.flagright.com/docs/flagright-api/c2NoOjMyNjczNTMy-transaction',
  USER: 'https://docs.flagright.com/docs/flagright-api/c2NoOjMyNjczMTQ3-user',
  BUSINESS: 'https://docs.flagright.com/docs/flagright-api/c2NoOjMzMTQzMTI4-business',
};

// TODO: Use server-provided feature flag
const CUSTOM_FORMAT_TENANTS = ['sh-payment'];

// Limit of .csv file to be uploaded
const FILE_UPLOAD_LIMIT_IN_BYTE = 10240000;

interface FileImportButtonProps {
  type: ImportRequestTypeEnum;
  buttonText?: string;
  requiredPermissions: Permission[];
}
export const FileImportButton: React.FC<FileImportButtonProps> = ({
  type,
  buttonText,
  requiredPermissions,
}) => {
  const [loading, setLoading] = useState(false);
  const [format, setFormat] = useState<ImportRequestFormatEnum>('flagright');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [file, setFile] = useState<FileInfo>();
  const [errorText, setErrorText] = useState<string>();
  const user = useAuth0User();
  const api = useApi();
  const isCustomFormatSupported = user && CUSTOM_FORMAT_TENANTS.includes(user.tenantName);
  const handleClose = useCallback(() => {
    setIsModalVisible(false);
    setFile(undefined);
    setErrorText(undefined);
  }, []);
  const handleImport = useCallback(
    (type: ImportRequestTypeEnum) => {
      async function startImport() {
        setLoading(true);
        const hideMessage = message.loading('Importing...');
        if (!file) {
          message.error('Please upload a file');
          setLoading(false);
          return;
        }

        const { s3Key, filename } = file;

        if (!s3Key || !filename) {
          message.fatal('Something went wrong', new Error('Missing s3Key or filename'));
          setLoading(false);
          return;
        }

        try {
          try {
            const data = { ImportRequest: { type, format, s3Key, filename } };

            type === 'TRANSACTION'
              ? await api.postImportTransactions(data)
              : await api.postImportUsers(data);
          } catch (e) {
            // If the import takes more than 29 seconds, we ignore the error and
            // poll for the import status
          }
          const importId = s3Key.replace(/\//g, '');

          for (const _i of range(0, 100)) {
            const importInfo = await api.getImportImportId({ importId });
            if (importInfo) {
              const latestStatus = last(importInfo.statuses);
              if (latestStatus?.status === 'FAILED') {
                setErrorText(importInfo.error);
                message.fatal('Failed to import the file', new Error(importInfo.error));
                return;
              } else if (latestStatus?.status === 'SUCCESS') {
                message.success(
                  `Imported ${importInfo.importedRecords} ${type.toLowerCase()} records`,
                );
                handleClose();
                return;
              }
            }
            await sleep(10 * 1000);
          }
          message.fatal('Failed to import the file - timeout', new Error('Timeout error'));
        } finally {
          hideMessage && hideMessage();
          setLoading(false);
        }
      }
      startImport();
    },
    [api, file, format, handleClose],
  );

  return (
    <>
      <Button
        analyticsName="Import"
        onClick={() => setIsModalVisible(true)}
        requiredPermissions={requiredPermissions}
      >
        {loading ? <LoadingOutlined /> : <UploadOutlined />}
        {buttonText || 'Import'}
      </Button>
      <Modal
        title={`Import ${humanizeConstant(type)}`}
        isOpen={isModalVisible}
        okText="Import"
        onCancel={handleClose}
        okProps={{ isDisabled: !file, isLoading: loading, isDanger: true }}
        onOk={() => handleImport(type)}
        writePermissions={requiredPermissions}
      >
        <Select<ImportRequestFormatEnum> value={format} onChange={setFormat}>
          <Select.Option value="flagright">Flagright format (.csv)</Select.Option>
          {isCustomFormatSupported && <Select.Option value="custom">Custom format</Select.Option>}
        </Select>
        {format === 'flagright' && (
          <Alert
            style={{ marginTop: 10 }}
            description={
              <div>
                <p>
                  A header name is a flattened path of the{' '}
                  <a href={OPENAPI_REF[type]} target="_blank">
                    schema
                  </a>
                  . For example, 'originAmountDetails.country', or 'tags.0.key' for array type.
                </p>
                <a href={EXAMPLE_FILE_URL[type]} target="_blank">
                  Example file
                </a>
              </div>
            }
            type="info"
          />
        )}
        <Divider />
        {file ? (
          <div>
            <span>{`${file.filename} (${filesize(file.size)})`}</span>
            {errorText && <Alert type="error" description={errorText} />}
          </div>
        ) : (
          <Dragger
            accept=".csv"
            key="import"
            showUploadList={false}
            customRequest={async ({ file: f }) => {
              const file = f;

              if (!(file instanceof File)) {
                message.error('Please upload a file');
                return;
              }

              //to check the size of csv file(in bytes)
              const fsize = file.size;
              if (fsize >= FILE_UPLOAD_LIMIT_IN_BYTE) {
                message.error(
                  `File too big, please select a file less than ${filesize(
                    FILE_UPLOAD_LIMIT_IN_BYTE,
                  )}`,
                );
                return;
              }
              setLoading(true);
              const hideMessage = message.loading('Uploading...');
              try {
                const { s3Key } = await uploadFile(api, file);
                setFile({ s3Key, filename: file.name, size: file.size });
                hideMessage();
              } catch (error) {
                message.fatal('Failed to upload the file', error);
              } finally {
                hideMessage && hideMessage();
                setLoading(false);
              }
            }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">
              Click or drag file to this area to upload a CSV file (comma delimited). Max file size:{' '}
              {filesize(FILE_UPLOAD_LIMIT_IN_BYTE)}
            </p>
          </Dragger>
        )}
      </Modal>
    </>
  );
};
