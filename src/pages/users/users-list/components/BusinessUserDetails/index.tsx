import ProDescriptions from '@ant-design/pro-descriptions';
import { ProColumns } from '@ant-design/pro-table';
import { Col, Divider, Row, Typography } from 'antd';
import { useState } from 'react';
import { UserTransactionHistoryTable } from '../UserTransactionHistoryTable';
import UserManualRiskPanel from '../UserManualRiskPanel';
import CollapsableSection from '../CollapsableSection';
import s from './styles.module.less';
import PersonsTable from './PersonsTable';
import { getUserName } from '@/utils/api/users';
import { useApi } from '@/api';
import { UploadFilesList } from '@/components/files/UploadFilesList';
import { InternalBusinessUser } from '@/apis';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';

interface Props {
  user: InternalBusinessUser;
  columns: ProColumns<InternalBusinessUser>[];
}

export const BusinessUserDetails: React.FC<Props> = ({ user, columns }) => {
  const api = useApi();
  const userId = user.userId;
  const [isShareholdersCollapsed, setShareholdersCollapsed] = useState(true);
  const [isDirectorsCollapsed, setDirectorsCollapsed] = useState(true);
  return (
    <>
      <Row justify="space-between" align="middle">
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
      <Divider />
      <ProDescriptions<InternalBusinessUser>
        column={2}
        request={async () => ({
          data: user || {},
        })}
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
};
