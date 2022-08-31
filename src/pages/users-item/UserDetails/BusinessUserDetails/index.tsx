import ProDescriptions from '@ant-design/pro-descriptions';
import { ProColumns } from '@ant-design/pro-table';
import { Col, Divider, Row, Typography } from 'antd';
import { useCallback, useState } from 'react';
import UserTransactionHistoryTable from '../UserTransactionHistoryTable';
import UserManualRiskPanel from '../UserManualRiskPanel';
import s from './styles.module.less';
import PersonsTable from './PersonsTable';
import CollapsableSection from '@/pages/users-item/UserDetails/CollapsableSection';
import UserStateEditor from '@/pages/users-item/UserDetails/UserStateEditor';
import KycStatusEditor from '@/pages/users-item/UserDetails/KycStatusEditor';
import { getUserName } from '@/utils/api/users';
import { useApi } from '@/api';
import { UploadFilesList } from '@/components/files/UploadFilesList';
import { InternalBusinessUser } from '@/apis';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';

interface Props {
  user: InternalBusinessUser;
  columns: ProColumns<InternalBusinessUser>[];
  isEmbedded?: boolean;
}

export default function BusinessUserDetails(props: Props) {
  const { user, columns, isEmbedded } = props;
  const api = useApi();
  const userId = user.userId;
  const [isShareholdersCollapsed, setShareholdersCollapsed] = useState(true);
  const [isDirectorsCollapsed, setDirectorsCollapsed] = useState(true);
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
          <Typography.Title level={3} style={{ margin: 0 }}>
            {getUserName(user)}
          </Typography.Title>
        </Col>
        <Feature name="PULSE_MANUAL_USER_RISK_LEVEL">
          <Col>
            <UserManualRiskPanel userId={userId} />
          </Col>
        </Feature>
      </Row>
      <ProDescriptions column={2}>
        <ProDescriptions.Item label="User Status" style={{ paddingBottom: 0 }}>
          <UserStateEditor user={user} />
        </ProDescriptions.Item>
        <ProDescriptions.Item label="KYC Status" style={{ paddingBottom: 0 }}>
          <KycStatusEditor user={user} />
        </ProDescriptions.Item>
      </ProDescriptions>
      <Divider />
      <ProDescriptions<InternalBusinessUser>
        column={2}
        request={request}
        params={{ id: getUserName(user) }}
        columns={columns}
      />
      {user.shareHolders && user.shareHolders.length > 0 && (
        <CollapsableSection
          title={`Shareholders (${user.shareHolders.length})`}
          isCollapsed={isShareholdersCollapsed}
          onChangeCollapsed={setShareholdersCollapsed}
        >
          <PersonsTable persons={user.shareHolders} />
        </CollapsableSection>
      )}
      <Divider />
      {user.directors && user.directors.length > 0 && (
        <CollapsableSection
          title={`Directors (${user.directors.length})`}
          isCollapsed={isDirectorsCollapsed}
          onChangeCollapsed={setDirectorsCollapsed}
        >
          <PersonsTable persons={user.directors} />
        </CollapsableSection>
      )}
      <Divider className={s.divider} orientation="left" orientationMargin="0">
        Transaction History
      </Divider>
      <UserTransactionHistoryTable userId={user.userId} />
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
    </>
  );
}
