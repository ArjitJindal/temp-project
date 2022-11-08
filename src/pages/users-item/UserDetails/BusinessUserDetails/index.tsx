import { useEffect } from 'react';
import PersonsTable from './PersonsTable';
import UserDetails from './UserDetails';
import ExpectedTransactionLimits from './TransactionLimits';
import { useApi } from '@/api';
import { InternalBusinessUser } from '@/apis';
import * as Card from '@/components/ui/Card';
import DocumentsCard from '@/pages/users-item/UserDetails/DocumentsCard';
import { ExpandTabRef } from '@/pages/case-management-item/UserCaseDetails';

interface Props {
  user: InternalBusinessUser;
  isEmbedded?: boolean;
  collapsedByDefault?: boolean;
  userDetailsRef?: React.Ref<ExpandTabRef>;
  expectedTransactionsRef?: React.Ref<ExpandTabRef>;
  shareHoldersRef?: React.Ref<ExpandTabRef>;
  dierctorsRef?: React.Ref<ExpandTabRef>;
  documentsRef?: React.Ref<ExpandTabRef>;
}

export default function BusinessUserDetails(props: Props) {
  const { user, isEmbedded, collapsedByDefault } = props;
  const api = useApi();

  useEffect(() => {
    console.log(collapsedByDefault);
  }, [collapsedByDefault]);
  return (
    <>
      <Card.Root
        header={{
          title: 'User Details',
          collapsedByDefault,
        }}
        ref={props.userDetailsRef}
      >
        <UserDetails user={user} />
      </Card.Root>
      <Card.Root
        header={{
          title: 'Expected Transaction Limits',
          collapsedByDefault,
        }}
        ref={props.expectedTransactionsRef}
      >
        <ExpectedTransactionLimits user={user} />
      </Card.Root>
      <Card.Root
        header={{
          title: 'Shareholders',
          collapsedByDefault,
        }}
        ref={props.shareHoldersRef}
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
        ref={props.dierctorsRef}
      >
        {user.directors && user.directors.length > 0 && <PersonsTable persons={user.directors} />}
      </Card.Root>
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
        documentsRef={props.documentsRef}
      />
    </>
  );
}
