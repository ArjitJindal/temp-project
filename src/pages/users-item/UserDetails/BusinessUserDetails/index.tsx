import UserTransactionHistoryTable from '../UserTransactionHistoryTable';
import PersonsTable from './PersonsTable';
import UserDetails from './UserDetails';
import ExpectedTransactionLimits from './TransactionLimits';
import { useApi } from '@/api';
import { InternalBusinessUser } from '@/apis';
import * as Card from '@/components/ui/Card';
import DocumentsCard from '@/pages/users-item/UserDetails/DocumentsCard';

interface Props {
  user: InternalBusinessUser;
  isEmbedded?: boolean;
  collapsedByDefault?: boolean;
}

export default function BusinessUserDetails(props: Props) {
  const { user, isEmbedded, collapsedByDefault } = props;
  const api = useApi();
  return (
    <>
      <Card.Root
        header={{
          title: 'User Details',
          collapsedByDefault,
        }}
      >
        <UserDetails user={user} />
      </Card.Root>
      <Card.Root
        header={{
          title: 'Expected Transaction Limits',
          collapsedByDefault,
        }}
      >
        <ExpectedTransactionLimits user={user} />
      </Card.Root>
      <Card.Root
        header={{
          title: 'Shareholders',
          collapsedByDefault,
        }}
      >
        {user.shareHolders && user.shareHolders.length > 0 && (
          <PersonsTable persons={user.shareHolders} />
        )}
      </Card.Root>
      <Card.Root
        header={{
          title: 'Directors',
          collapsedByDefault,
        }}
      >
        {user.directors && user.directors.length > 0 && <PersonsTable persons={user.directors} />}
      </Card.Root>
      <UserTransactionHistoryTable userId={user.userId} />
      <DocumentsCard
        user={user}
        collapsedByDefault={collapsedByDefault}
        isEmbedded={isEmbedded}
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
    </>
  );
}
