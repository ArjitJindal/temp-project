import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { PaperClipOutlined, UploadOutlined } from '@ant-design/icons';
import fileSize from 'filesize';
import s from './index.module.less';
import Warning from '@/components/ui/icons/Remix/system/error-warning-line.react.svg';
import Modal from '@/components/library/Modal';
import FilesDraggerInput from '@/components/ui/FilesDraggerInput';
import TextArea from '@/components/library/TextArea';
import { FileInfo, PersonAttachment } from '@/apis';
import { useApi } from '@/api';
import { getErrorMessage } from '@/utils/lang';
import { message } from '@/components/library/Message';
import COLORS from '@/components/ui/colors';
import { sanitizeComment } from '@/components/markdown/MarkdownEditor/mention-utlis';

interface Props {
  attachments: PersonAttachment[];
  userId: string;
  personId: string;
  currentUserId: string;
  isShareHolder: boolean;
}

export default function Attachment(props: Props) {
  const { userId, personId, currentUserId, isShareHolder, attachments } = props;
  const [modalOpen, setModalOpenStatus] = useState(false);

  const handleCancel = () => {
    setModalOpenStatus(false);
  };

  return (
    <div className={s.root}>
      <div className={s.header}>
        <div className={s.title}>
          Attachments (
          {attachments.reduce(
            (total, attachment) =>
              total + (currentUserId === attachment.userId ? attachment.files.length : 0),
            0,
          )}
          )
        </div>
        <div className={s.fileAttachmentButton} onClick={() => setModalOpenStatus(true)}>
          <div className={s.section}>
            <UploadOutlined style={{ color: COLORS.brandBlue.base, flexShrink: 0 }} />
            <div className={s.filename}>Upload</div>
          </div>
        </div>
      </div>
      <div className={s.items}>
        {attachments.length > 0
          ? attachments.map((attachment) => {
              if (currentUserId !== attachment.userId) {
                return null;
              }
              return attachment.files.map((file) => {
                return (
                  <div key={file.s3Key} className={s.files}>
                    <div className={s.fileAttachmentButton} data-cy="attached-file">
                      <a href={file.downloadLink}>
                        <div className={s.section}>
                          <PaperClipOutlined
                            style={{ color: COLORS.purpleGray.base, flexShrink: 0 }}
                          />
                          <div className={s.filename} title={file.filename}>
                            {file.filename}
                          </div>
                          <span className={s.size}>{`(${fileSize(file.size)})`}</span>
                        </div>
                      </a>
                    </div>
                  </div>
                );
              });
            })
          : 'No attachment found'}
      </div>

      <AttachmentUploadModal
        isOpen={modalOpen}
        handleCancel={handleCancel}
        userId={userId}
        personId={personId}
        currentUserId={currentUserId}
        isShareHolder={isShareHolder}
      />
    </div>
  );
}

interface ModalProps {
  isOpen: boolean;
  handleCancel: () => void;
  isShareHolder: boolean;
  userId: string;
  personId: string;
  currentUserId: string;
}

const AttachmentUploadModal = (props: ModalProps) => {
  const { isOpen, handleCancel, isShareHolder, userId, personId, currentUserId } = props;
  const [comment, setComment] = useState('');
  const [fileList, setFileList] = useState<FileInfo[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const api = useApi();

  const handleUploadingChange = (uploading: boolean) => setIsUploading(uploading);
  const attachmentSubmitMutation = useMutation<
    PersonAttachment,
    unknown,
    {
      userId: string;
      personId: string;
      files: FileInfo[];
      comment: string;
    }
  >(
    async ({ userId, personId, files, comment }) => {
      if (isShareHolder) {
        return api.postUserShareholderAttachment({
          userId,
          shareholderId: personId,
          UserAttachmentUpdateRequest: {
            attachment: {
              files,
              comment,
              userId: currentUserId,
            },
          },
        });
      } else {
        return api.postUserDirectorAttachment({
          userId,
          directorId: personId,
          UserAttachmentUpdateRequest: {
            attachment: {
              files,
              comment,
              userId: currentUserId,
            },
          },
        });
      }
    },
    {
      onSuccess: () => {
        message.success('Attachment successfully added!');
      },
      onError: (error) => {
        message.fatal(`Unable to add attachment! ${getErrorMessage(error)}`, error);
      },
    },
  );

  return (
    <Modal
      isOpen={isOpen}
      cancelText="Cancel"
      okText="Upload"
      onCancel={handleCancel}
      onOk={() => {
        if (isUploading) {
          return;
        }
        if (fileList.length === 0) {
          message.warn('Please upload at least one file!');
          return;
        }
        if (userId != null && personId != null && currentUserId != null && !isUploading) {
          attachmentSubmitMutation.mutate({
            userId,
            personId,
            files: fileList,
            comment: sanitizeComment(comment),
          });
        }
      }}
      title="Upload documents"
      maskClosable={false}
      width="S"
    >
      <div className={s.modalroot}>
        <div className={s.modalbody}>
          <FilesDraggerInput
            singleFile={false}
            value={fileList}
            onChange={(value) => {
              setFileList(value ?? []);
            }}
            info={'Supported file types: PDF, JPG, PNG'}
            listType="attachment"
            setUploading={handleUploadingChange}
          />

          <div>
            <div className={s.modaltitle}>Comment</div>
            <TextArea
              showCount
              maxLength={100}
              onChange={(value) => setComment(value ?? '')}
              value={comment}
              placeholder="Enter your text here"
            />
          </div>

          <div className={s.modalinfo}>
            <Warning width={32} />
            <span className={s.modalsubTitle}>
              Uploaded document alone can be accessed from here. You can see detailed upload with
              comments under 'Activity'.
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
};
