import { Tag, Tooltip, Form, Input, message, Modal, Select } from 'antd';
import { useCallback, useRef, useState } from 'react';
import {
  browserName,
  browserVersion,
  deviceType,
  mobileModel,
  mobileVendor,
  osName,
} from 'react-device-detect';
import style from './index.module.less';
import {
  caseStatusToOperationName,
  CLOSING_REASONS,
  COMMON_REASONS,
  FormValues,
  OTHER_REASON,
  RemoveAllFilesRef,
} from './CaseStatusChangeForm';
import BrainIcon from '@/components/ui/icons/brain-icon.react.svg';
import COLORS from '@/components/ui/colors';
import { CaseStatus, FileInfo } from '@/apis';
import { useApi } from '@/api';
import { UploadFilesList } from '@/components/files/UploadFilesList';
import { useAnalytics } from '@/utils/segment/context';
import { useAuth0User } from '@/utils/user-utils';

interface Props {
  confidence: number;
  caseIds: string[];
  newCaseStatus: CaseStatus;
  onSaved: () => void;
  isBlue?: boolean;
  rounded?: boolean;
}

export const FalsePositiveTag: React.FC<Props> = (props: Props) => {
  const { caseIds, onSaved, newCaseStatus, confidence } = props;
  const [isModalVisible, setModalVisible] = useState(false);
  const [isOtherReason, setIsOtherReason] = useState(false);
  const [defaultReasons, setDefaultReasons] = useState<string[]>([]);
  const [isSaving, setSaving] = useState(false);
  const [form] = Form.useForm<FormValues>();
  const [isAwaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [formValues, setFormValues] = useState<FormValues>();
  const [files, setFiles] = useState<FileInfo[]>([]);
  const analytics = useAnalytics();
  const user = useAuth0User();

  const api = useApi();

  const removeFiles = useCallback(() => {
    setFiles([]);
    uploadRef.current?.removeAllFiles();
  }, []);

  const possibleReasons = [...COMMON_REASONS, ...CLOSING_REASONS];
  // todo: i18n
  const modalMessagePrefix = 'Are you sure you want to';
  const caseIdsString = caseIds.join(', ');
  const uploadRef = useRef<RemoveAllFilesRef>(null);
  const handleUpdateTransaction = useCallback(
    async (values: FormValues) => {
      const hideMessage = message.loading(`Saving...`, 0);
      try {
        setSaving(true);
        await api.postCases({
          CasesUpdateRequest: {
            caseIds,
            updates: {
              caseStatus: newCaseStatus,
              otherReason:
                values.reasons.indexOf(OTHER_REASON) !== -1 ? values.reasonOther ?? '' : undefined,
              reason: values.reasons,
              files,
            },
          },
        });
        message.success('Saved');
        setModalVisible(false);
        onSaved();
        analytics.event({
          title: 'Console case details - False positive label clicked',
          tenant: user.tenantName,
          userId: user.userId,
          browserName,
          deviceType,
          browserVersion,
          osName,
          mobileModel,
          mobileVendor,
        });
      } catch (e) {
        message.error('Failed to save');
      } finally {
        hideMessage();
        setSaving(false);
      }
    },
    [api, caseIds, newCaseStatus, files, onSaved, analytics, user.tenantName, user.userId],
  );
  return (
    <>
      <span className={style.falsePositiveTag}>
        <Tooltip title={'Accuracy increases as you close more cases.'}>
          <Tag
            color={COLORS.navyBlue.base}
            onClick={() => {
              if (newCaseStatus === 'CLOSED') {
                setModalVisible(true);
                setDefaultReasons(['False Positive']);
              } else {
                setAwaitingConfirmation(true);
              }
            }}
            icon={
              <span className={style.icon}>
                <BrainIcon />
              </span>
            }
            className={style.tagOnHover}
          >
            {confidence}% False Positive
          </Tag>
        </Tooltip>
      </span>
      <Modal
        title={'Close Case'}
        visible={isModalVisible}
        okButtonProps={{
          disabled: isSaving,
        }}
        onOk={() => {
          form.validateFields().then((values) => {
            removeFiles();
            setFormValues(values);
            setAwaitingConfirmation(true);
            setModalVisible(false);
          });
        }}
        onCancel={() => {
          removeFiles();
          setAwaitingConfirmation(false);
          setModalVisible(false);
        }}
      >
        <Form<FormValues>
          form={form}
          layout="vertical"
          name="form_in_modal"
          initialValues={{
            reasons: defaultReasons,
            reasonOther: null,
          }}
        >
          <Form.Item
            name="reasons"
            label="Reason"
            initialValue={CLOSING_REASONS}
            rules={[{ required: true, message: 'Please enter a Reason' }]}
          >
            <Select<string[]>
              mode="multiple"
              value={CLOSING_REASONS}
              defaultValue={[CLOSING_REASONS[0], CLOSING_REASONS[1]]}
              onChange={(value) => setIsOtherReason(value.includes(OTHER_REASON))}
            >
              {possibleReasons.map((label) => (
                <Select.Option key={label} value={label}>
                  {label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          {isOtherReason && (
            <Form.Item
              name="reasonOther"
              label="Describe the reason"
              rules={[{ required: true, message: 'Please describe the reason', max: 50 }]}
            >
              <Input />
            </Form.Item>
          )}
          <Form.Item name="documents" label="Attach documents">
            <UploadFilesList
              files={files}
              onFileUploaded={async (file) => {
                setFiles((prevFiles) => prevFiles.concat(file));
              }}
              onFileRemoved={async (fileS3Key) => {
                setFiles((prevFiles) =>
                  prevFiles.filter((prevFile) => prevFile.s3Key !== fileS3Key),
                );
              }}
              ref={uploadRef}
            />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="ⓘ Confirm action"
        visible={isAwaitingConfirmation}
        okButtonProps={{
          disabled: isSaving,
        }}
        okText="Confirm"
        onOk={() => {
          if (newCaseStatus === 'CLOSED') {
            handleUpdateTransaction(formValues as FormValues)
              .then(() => {
                removeFiles();
                form.resetFields();
                setIsOtherReason(false);
                setAwaitingConfirmation(false);
              })
              .catch((info) => {
                console.log('Failed to save ', info);
              });
          }
        }}
        onCancel={() => {
          removeFiles();
          setAwaitingConfirmation(false);
          setModalVisible(false);
        }}
      >
        {modalMessagePrefix} <b>{caseStatusToOperationName(newCaseStatus)}</b>{' '}
        <b>{caseIdsString}</b> ?
      </Modal>
    </>
  );
};
