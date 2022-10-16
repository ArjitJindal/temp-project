import * as Card from '@/components/ui/Card';
import { FileInfo, InternalBusinessUser, InternalConsumerUser } from '@/apis';
import { UploadFilesList } from '@/components/files/UploadFilesList';

interface Props {
  user: InternalConsumerUser | InternalBusinessUser;
  isEmbedded?: boolean;
  collapsedByDefault?: boolean;
  onFileUploaded: (file: FileInfo) => Promise<void>;
  onFileRemoved: (s3Key: string) => Promise<void>;
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
