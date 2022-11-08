import * as Card from '@/components/ui/Card';
import { FileInfo, InternalBusinessUser, InternalConsumerUser } from '@/apis';
import { UploadFilesList } from '@/components/files/UploadFilesList';
import { ExpandTabRef } from '@/pages/case-management-item/UserCaseDetails';

interface Props {
  user: InternalConsumerUser | InternalBusinessUser;
  isEmbedded?: boolean;
  collapsedByDefault?: boolean;
  onFileUploaded: (file: FileInfo) => Promise<void>;
  onFileRemoved: (s3Key: string) => Promise<void>;
  documentsRef?: React.Ref<ExpandTabRef>;
}

export default function DocumentsCard(props: Props) {
  const { user, isEmbedded, collapsedByDefault, onFileUploaded, onFileRemoved } = props;
  const files = user.files || [];
  return (
    <Card.Root
      disabled={isEmbedded && files.length === 0}
      header={{
        title: 'Documents',
        collapsedByDefault,
      }}
      ref={props.documentsRef}
    >
      <Card.Section>
        <UploadFilesList
          files={files}
          disableUpload={isEmbedded}
          onFileUploaded={onFileUploaded}
          onFileRemoved={onFileRemoved}
        />
      </Card.Section>
    </Card.Root>
  );
}
