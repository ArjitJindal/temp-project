import ProDescriptions from '@ant-design/pro-descriptions';
import { ProColumns } from '@ant-design/pro-table';
import { Col, Divider, Row, Typography } from 'antd';
import { UserTransactionHistoryTable } from './UserTransactionHistoryTable';
import { getUserName } from '@/utils/api/users';
import { useApi } from '@/api';
import { UploadFilesList } from '@/components/files/UploadFilesList';
import { InternalConsumerUser } from '@/apis';
import UserManualRiskPanel from '@/pages/users/users-list/components/UserManualRiskPanel';
import { Feature } from '@/components/AppWrapper/FeaturesProvider';

interface Props {
  user: InternalConsumerUser;
  columns: ProColumns<InternalConsumerUser>[];
}

export const ConsumerUserDetails: React.FC<Props> = ({ user, columns }) => {
  const api = useApi();
  const userId = user.userId;

  return (
    <>
      <Row justify="space-between" align="middle">
        <Col>
          <Typography.Title level={5} style={{ margin: 0 }}>
            {getUserName(user)}
          </Typography.Title>
        </Col>
        <Feature name="PULSE_MANUAL_USER_RISK_LEVEL">
          <Col>
            <UserManualRiskPanel userId={userId} />
          </Col>
        </Feature>
      </Row>
      <Divider />
      <ProDescriptions<InternalConsumerUser>
        column={2}
        request={async () => ({
          data: user || {},
        })}
        params={{ id: getUserName(user) }}
        columns={columns}
      />
      <UserTransactionHistoryTable userId={userId} />
      <Divider orientation="left" orientationMargin="0">
        Documents
      </Divider>
      <UploadFilesList
        files={user.files || []}
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
};
