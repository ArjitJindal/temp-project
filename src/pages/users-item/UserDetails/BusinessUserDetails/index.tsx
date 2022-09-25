import { Divider } from 'antd';
import UserTransactionHistoryTable from '../UserTransactionHistoryTable';
import s from './styles.module.less';
import PersonsTable from './PersonsTable';
import UserDetails from './UserDetails';
import ExpectedTransactionLimits from './TransactionLimits';
import { useApi } from '@/api';
import { UploadFilesList } from '@/components/files/UploadFilesList';
import { InternalBusinessUser } from '@/apis';
import * as Card from '@/components/ui/Card';

interface Props {
  user: InternalBusinessUser;
  isEmbedded?: boolean;
}

export default function BusinessUserDetails(props: Props) {
  const { user, isEmbedded } = props;
  const api = useApi();
  return (
    <Card.Section>
      <Card.Root
        header={{
          title: 'User Details',
        }}
      >
        <UserDetails user={user} />
      </Card.Root>
      <Card.Root
        header={{
          title: 'Expected Transaction Limits',
        }}
      >
        <ExpectedTransactionLimits user={user} />
      </Card.Root>
      <Card.Root
        header={{
          title: 'Shareholders',
        }}
      >
        {user.shareHolders && user.shareHolders.length > 0 && (
          <PersonsTable persons={user.shareHolders} />
        )}
      </Card.Root>
      <Card.Root
        header={{
          title: 'Directors',
        }}
      >
        {user.directors && user.directors.length > 0 && <PersonsTable persons={user.directors} />}
      </Card.Root>
      <Card.Root
        header={{
          title: 'Transaction History',
        }}
      >
        <UserTransactionHistoryTable userId={user.userId} />
      </Card.Root>
      <Divider className={s.divider} orientation="left" orientationMargin="0">
        Documents
      </Divider>
      <UploadFilesList
        files={user.files || []}
        disableUpload={isEmbedded}
        onFileUploaded={async (file) => {
          await api.postBusinessUsersUserIdFiles({
            userId: user.userId,
            FileInfo: file,
          });
        }}
        onFileRemoved={async (fileS3Key: string) => {
          await api.deleteBusinessUsersUserIdFilesFileId({
            userId: user.userId,
            fileId: fileS3Key,
          });
        }}
      />
    </Card.Section>
  );
}
