import { InboxOutlined, LoadingOutlined, UploadOutlined } from '@ant-design/icons';
import { Alert, Divider, message, Modal, Select } from 'antd';
import axios from 'axios';
import { useCallback, useState } from 'react';
import Dragger from 'antd/es/upload/Dragger';
import filesize from 'filesize';
import _ from 'lodash';
import Button from '@/components/ui/Button';
import { FileInfo, ImportRequestFormatEnum, ImportRequestTypeEnum } from '@/apis';
import { useApi } from '@/api';
import { sleep } from '@/utils/time-utils';
import { useAuth0User } from '@/utils/user-utils';

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
}
export const FileImportButton: React.FC<FileImportButtonProps> = ({ type, buttonText }) => {
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
  const handleImport = useCallback(() => {
    async function startImport() {
      setLoading(true);
      const hideMessage = message.loading('Importing...', 0);
      try {
        try {
          await api.postImport({
            ImportRequest: {
              type,
              format,
              s3Key: file?.s3Key as string,
              filename: file?.filename as string,
            },
          });
        } catch (e) {
          // If the import takes more than 29 seconds, we ignore the error and
          // poll for the import status
        }
        const importId = file?.s3Key.replace(/\//g, '') as string;
        for (const i of _.range(0, 100)) {
          const importInfo = await api.getImportImportId({ importId });
          const latestStatus = _.last(importInfo.statuses);
          if (latestStatus?.status === 'FAILED') {
            setErrorText(importInfo.error);
            message.error('Failed to import the file');
            return;
          } else if (latestStatus?.status === 'SUCCESS') {
            message.success(`Imported ${importInfo.importedRecords} ${type.toLowerCase()} records`);
            handleClose();
            return;
          }
          await sleep(10 * 1000);
        }
        message.error('Failed to import the file - timeout');
      } finally {
        hideMessage && hideMessage();
        setLoading(false);
      }
    }
    startImport();
  }, [api, file?.filename, file?.s3Key, format, handleClose, type]);

  return (
    <>
      <Button analyticsName="Import" onClick={() => setIsModalVisible(true)}>
        {loading ? <LoadingOutlined /> : <UploadOutlined />}
        {buttonText || 'Import'}
      </Button>
      <Modal
        title={`Import ${type}`}
        visible={isModalVisible}
        okText="Import"
        onCancel={handleClose}
        okButtonProps={{ disabled: !file, loading, danger: true }}
        onOk={handleImport}
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
              const file = f as File;

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
              const hideMessage = message.loading('Uploading...', 0);
              try {
                // 1. Get S3 presigned URL
                const { presignedUrl, s3Key } = await api.postGetPresignedUrl({});

                // 2. Upload file to S3 directly
                await axios.put(presignedUrl, file, {
                  headers: {
                    'Content-Disposition': `attachment; filename="${file?.name}"`,
                  },
                });
                setFile({ s3Key, filename: file.name, size: file.size });
                hideMessage();
              } catch (error) {
                message.error('Failed to upload the file');
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
