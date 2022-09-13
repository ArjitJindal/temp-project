import ProDescriptions from '@ant-design/pro-descriptions';
import { ProColumns } from '@ant-design/pro-table';
import { Col, Divider, Row } from 'antd';
import { useCallback } from 'react';
import s from 'index.module.less';
import UserTransactionHistoryTable from '../UserTransactionHistoryTable';
import Avatar from '../../../transactions-item/UserDetails/Avatar';
import UserManualRiskPanel from '@/pages/users-item/UserDetails/UserManualRiskPanel';
import UserStateEditor from '@/pages/users-item/UserDetails/UserStateEditor';
import KycStatusEditor from '@/pages/users-item/UserDetails/KycStatusEditor';
import { getUserName } from '@/utils/api/users';
import { useApi } from '@/api';
import { UploadFilesList } from '@/components/files/UploadFilesList';
import { InternalConsumerUser } from '@/apis';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';
import Id from '@/components/ui/Id';
import { makeUrl } from '@/utils/routing';

interface Props {
  user: InternalConsumerUser;
  columns: ProColumns<InternalConsumerUser>[];
  isEmbedded?: boolean;
}

export default function UserDetails(props: Props) {
  const { user, columns, isEmbedded } = props;
  const api = useApi();
  const userId = user.userId;
  const request = useCallback(
    async () => ({
      data: user || {},
    }),
    [user],
  );

  return (
    <>
      <Row justify="space-between" align="middle" style={{ paddingBottom: 24 }}>
        <Col>
          <div className={s.user}>
            <Avatar name={user ? getUserName(user) : undefined} />
            <div className={s.name}>{user ? getUserName(user) : 'User undefined'}</div>
            {user && (
              <Id
                to={makeUrl('/users/list/:list/:id', {
                  list: 'consumer',
                  id: user.userId,
                })}
              >
                {user.userId}
              </Id>
            )}
          </div>
        </Col>
        <Feature name="PULSE_MANUAL_USER_RISK_LEVEL">
          <Col>
            <UserManualRiskPanel userId={userId} />
          </Col>
        </Feature>
      </Row>
      <ProDescriptions column={2}>
        <ProDescriptions.Item label="User State" style={{ paddingBottom: 0 }}>
          <UserStateEditor user={user} />
        </ProDescriptions.Item>
        <ProDescriptions.Item label="KYC Status" style={{ paddingBottom: 0 }}>
          <KycStatusEditor user={user} />
        </ProDescriptions.Item>
      </ProDescriptions>
      <Divider />
      <ProDescriptions<InternalConsumerUser>
        column={2}
        request={request}
        params={{ id: getUserName(user) }}
        columns={columns}
      />
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
    </>
  );
}
