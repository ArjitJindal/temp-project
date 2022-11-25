import UserDetails from '../ConsumerUserDetails/UserDetails/index';
import { LegalDocumentsTable } from './LegalDocuments';
import { InternalConsumerUser } from '@/apis';
import { useApi } from '@/api';
import DocumentsCard from '@/pages/users-item/UserDetails/DocumentsCard';
import { ExpandTabRef } from '@/pages/case-management-item/UserCaseDetails';

interface Props {
  user: InternalConsumerUser;
  isEmbedded?: boolean;
  collapsedByDefault?: boolean;
  userDetailsRef?: React.Ref<ExpandTabRef>;
  legalDocumentsRef?: React.Ref<ExpandTabRef>;
  documentsRef?: React.Ref<ExpandTabRef>;
  updateCollapseState?: (key: string, value: boolean) => void;
}

export default function ConsumerUserDetails(props: Props) {
  const { user, isEmbedded, collapsedByDefault } = props;
  const api = useApi();
  const userId = user.userId;
  return (
    <>
      <UserDetails
        user={user}
        collapsedByDefault={collapsedByDefault}
        userDetailsRef={props.userDetailsRef}
        updateCollapseState={props.updateCollapseState}
      />
      <LegalDocumentsTable
        person={user}
        collapsedByDefault={collapsedByDefault}
        legalDocumentsRef={props.legalDocumentsRef}
        updateCollapseState={props.updateCollapseState}
      />
      <DocumentsCard
        user={user}
        collapsedByDefault={collapsedByDefault}
        isEmbedded={isEmbedded}
        documentsRef={props.documentsRef}
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
        updateCollapseState={props.updateCollapseState}
      />
    </>
  );
}
