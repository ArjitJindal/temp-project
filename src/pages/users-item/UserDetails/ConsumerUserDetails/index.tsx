import UserDetails from '../ConsumerUserDetails/UserDetails/index';
import { LegalDocumentsTable } from './LegalDocuments';
import { InternalConsumerUser } from '@/apis';
import { useApi } from '@/api';
import DocumentsCard from '@/pages/users-item/UserDetails/DocumentsCard';

interface Props {
  user: InternalConsumerUser;
  isEmbedded?: boolean;
  collapsedByDefault?: boolean;
}

export default function ConsumerUserDetails(props: Props) {
  const { user, isEmbedded, collapsedByDefault } = props;
  const api = useApi();
  const userId = user.userId;
  return (
    <>
      <UserDetails user={user} collapsedByDefault={collapsedByDefault} />
      <LegalDocumentsTable person={user} collapsedByDefault={collapsedByDefault} />
      <DocumentsCard
        user={user}
        collapsedByDefault={collapsedByDefault}
        isEmbedded={isEmbedded}
        onFileUploaded={async (file) => {
          await api.postConsumerUsersUserIdFiles({
            userId: userId,
            FileInfo: file,
          });
        }}
        onFileRemoved={async (fileS3Key: string) => {
          await api.deleteConsumerUsersUserIdFilesFileId({
            userId: userId,
            fileId: fileS3Key,
          });
        }}
      />
    </>
  );
}
