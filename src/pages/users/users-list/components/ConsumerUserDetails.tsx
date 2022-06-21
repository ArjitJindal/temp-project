import ProDescriptions from '@ant-design/pro-descriptions';
import { ProColumns } from '@ant-design/pro-table';
import { Divider } from 'antd';
import { UserTransactionHistoryTable } from './UserTransactionHistoryTable';
import { getUserName } from '@/utils/api/users';
import { useApi } from '@/api';
import { UploadFilesList } from '@/components/files/UploadFilesList';
import { InternalConsumerUser } from '@/apis';

interface Props {
  user: InternalConsumerUser;
  columns: ProColumns<InternalConsumerUser>[];
}

export const ConsumerUserDetails: React.FC<Props> = ({ user, columns }) => {
  const api = useApi();
  return (
    <>
      <ProDescriptions<InternalConsumerUser>
        column={2}
        title={getUserName(user)}
        request={async () => ({
          data: user || {},
        })}
        params={{ id: getUserName(user) }}
        columns={columns}
      />
      <UserTransactionHistoryTable userId={user.userId} />
      <Divider orientation="left" orientationMargin="0">
        Documents
      </Divider>
      <UploadFilesList
        files={user.files || []}
        onFileUploaded={async (file) => {
          await api.postConsumerUsersUserIdFiles({
            userId: user.userId,
            FileInfo: file,
          });
        }}
        onFileRemoved={async (fileS3Key: string) => {
          await api.deleteConsumerUsersUserIdFilesFileId({
            userId: user.userId,
            fileId: fileS3Key,
          });
        }}
      />
    </>
  );
};
