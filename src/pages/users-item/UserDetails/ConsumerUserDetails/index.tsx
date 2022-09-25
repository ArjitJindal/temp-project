import { Divider } from 'antd';
import UserDetails from '../ConsumerUserDetails/UserDetails/index';
import UserTransactionHistoryTable from '../UserTransactionHistoryTable';
import { LegalDocumentsTable } from './LegalDocuments';
import { InternalConsumerUser } from '@/apis';
import * as Card from '@/components/ui/Card';
import { UploadFilesList } from '@/components/files/UploadFilesList';
import { useApi } from '@/api';

interface Props {
  user: InternalConsumerUser;
  isEmbedded?: boolean;
}

export default function ConsumerUserDetails(props: Props) {
  const { user, isEmbedded } = props;
  const api = useApi();
  const userId = user.userId;
  return (
    <Card.Section>
      <UserDetails user={user} />
      <LegalDocumentsTable person={user} />
      <UserTransactionHistoryTable userId={userId} />
      <Divider orientation="left" orientationMargin="0">
        Documents
      </Divider>
      <UploadFilesList
        files={user.files || []}
        disableUpload={isEmbedded}
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
    </Card.Section>
  );
}
