import React, { useImperativeHandle, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { PaperClipOutlined, UploadOutlined } from '@ant-design/icons';
import fileSize from 'filesize';
import s from './index.module.less';
import Modal from '@/components/library/Modal';
import FilesDraggerInput from '@/components/ui/FilesDraggerInput';
import { AttachmentUserType, Comment, FileInfo, PersonAttachment } from '@/apis';
import { useApi } from '@/api';
import { getErrorMessage } from '@/utils/lang';
import { message } from '@/components/library/Message';
import COLORS from '@/components/ui/colors';
import { sanitizeComment } from '@/components/markdown/MarkdownEditor/mention-utlis';
import MarkdownEditor from '@/components/markdown/MarkdownEditor';
import { CommentType, useHasResources } from '@/utils/user-utils';
import Select, { Option } from '@/components/library/Select';
import Label from '@/components/library/Label';

interface Props {
  attachments: PersonAttachment[];
  userId: string;
  personId: string;
  currentUserId: string;
  personType: AttachmentUserType;
  onNewComment?: (newComment: Comment, commentType: CommentType, personId?: string) => void;
}

export default function Attachment(props: Props) {
  const { userId, personId, currentUserId, attachments, personType, onNewComment } = props;
  const [modalOpen, setModalOpenStatus] = useState(false);
  const [userAttachment, setAttachment] = useState(attachments);
  const hasUserPermissions = useHasResources(['read:::users/user-details/*']);

  const updateAttachment = (attachment: PersonAttachment) => {
    setAttachment((attachments) => [attachment, ...attachments]);
  };

  const handleCancel = () => {
    setModalOpenStatus(false);
  };

  return (
    <div className={s.root}>
      <div className={s.header}>
        <div className={s.title}>
          Attachments (
          {userAttachment.reduce(
            (total, attachment) => total + (hasUserPermissions ? attachment.files.length : 0),
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
        {userAttachment.length > 0
          ? userAttachment.map((attachment) => {
              if (!hasUserPermissions) {
                return null;
              }
              return attachment.files.map((file) => {
                return (
                  <div key={file.s3Key} className={s.files}>
                    <div className={s.fileAttachmentButton} data-cy="attached-file">
                      <a href={file.downloadLink ?? ''}>
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
        personType={personType}
        updateAttachment={updateAttachment}
        onNewComment={onNewComment}
      />
    </div>
  );
}

interface ModalProps {
  isOpen: boolean;
  handleCancel: () => void;
  userId: string;
  personId: string;
  currentUserId: string;
  personType: AttachmentUserType;
  updateAttachment: (attachment: PersonAttachment) => void;
  onNewComment?: (newComment: Comment, commentType: CommentType, personId?: string) => void;
}

const AttachmentUploadModal = (props: ModalProps) => {
  const {
    isOpen,
    handleCancel,
    userId,
    personId,
    currentUserId,
    personType,
    updateAttachment,
    onNewComment,
  } = props;
  const [comment, setComment] = useState('');
  const [fileList, setFileList] = useState<FileInfo[]>([]);
  const [tags, setTags] = useState<string[]>([]);
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
      personType: AttachmentUserType;
      tags: string[];
    }
  >(
    async ({ userId, personId, files, comment, personType, tags }) => {
      return api.postUserAttachment({
        userId,
        personId: personId,
        personType,
        UserAttachmentUpdateRequest: {
          attachment: { files, comment, userId: currentUserId, tags },
        },
      });
    },
    {
      onSuccess: (data) => {
        console.info('new attachment', data);
        message.success('Attachment added successfully');
        updateAttachment(data);
        if (onNewComment) {
          onNewComment(
            {
              id: data.id,
              body: data.comment ?? '-',
              files: data.files,
              createdAt: data.createdAt,
              userId: data.userId,
              isAttachment: true,
            },
            personType === 'CONSUMER' || personType === 'BUSINESS'
              ? CommentType.USER
              : CommentType.SHAREHOLDERDIRECTOR,
            personId === userId ? undefined : personId,
          );
        }
        setFileList([]);
        setComment('');
        handleCancel();
      },
      onError: (error) => {
        message.fatal(`Unable to add attachment! ${getErrorMessage(error)}`, error);
      },
    },
  );

  const editorRef = useRef<MarkdownEditor>(null);

  useImperativeHandle(null, () => ({
    reset: () => {
      editorRef.current?.reset();
    },
  }));

  return (
    <Modal
      isOpen={isOpen}
      cancelText="Cancel"
      okText="Upload"
      width="M"
      okProps={{
        isDisabled: fileList.length === 0 || isUploading,
      }}
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
            personType,
            files: fileList,
            comment: sanitizeComment(comment),
            tags,
          });
        }
      }}
      title="Upload documents"
      maskClosable={true}
    >
      <div className={s.modalroot}>
        <div className={s.modalbody}>
          <FilesDraggerInput
            singleFile={false}
            value={fileList}
            onChange={(value) => {
              setFileList(value ?? []);
            }}
            info={'Supported file types: PDF, JPG, PNG, XLSX, DOCX'}
            listType="attachment"
            setUploading={handleUploadingChange}
            required={true}
          />

          <div className={s.commentsection}>
            <div>
              <div className={s.modaltitle}>Comment</div>
              <span className={s.modalsubTitle}>
                The submitted comment will be visible in the 'Activity' section.
              </span>
            </div>
            <MarkdownEditor
              ref={editorRef}
              initialValue={comment}
              onChange={(value) => setComment(value ?? '')}
              placeholder="Enter your text here"
            />
          </div>
          <Label label="Tags">
            <Select
              mode="TAGS"
              options={[] as Option<string>[]}
              placeholder="Select tags"
              value={tags}
              onChange={(value) => {
                setTags(value ?? []);
              }}
            />
          </Label>
        </div>
      </div>
    </Modal>
  );
};
