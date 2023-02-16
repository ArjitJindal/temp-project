import { Divider, Form, message, Modal, Select } from 'antd';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CreateTenantModal } from './CreateTenantModal';
import { useApi } from '@/api';
import Button from '@/components/library/Button';
import { Feature } from '@/apis';
import { useAuth0User } from '@/utils/user-utils';
import { useFeatures } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useAuth } from '@/components/AppWrapper/Providers/AuthProvider';

export const FEATURES: Feature[] = [
  'PULSE',
  'SLACK_ALERTS',
  'AUDIT_LOGS',
  'IMPORT_FILES',
  'LISTS',
  'HELP_CENTER',
  'SANCTIONS',
  'DASHBOARD_BLOCK_USER',
  'RULES_ENGINE_RULE_BASED_AGGREGATION',
  'FALSE_POSITIVE_CHECK',
  'DEMO_MODE',
];

export default function SuperAdminPanel() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [showCreateTenantModal, setShowCreateTenantModal] = useState(false);
  const initialFeatures = useFeatures();
  const [features, setFeatures] = useState<Feature[] | undefined>(undefined);
  const { refreshAccessToken } = useAuth();
  const user = useAuth0User();
  const api = useApi();
  const queryResult = useQuery(['tenants'], () => api.getTenantsList());
  const tenantOptions =
    queryResult.data?.map((tenant) => ({
      value: tenant.id,
      label: tenant.name,
    })) || [];

  const handleChangeTenant = async (newTenantId: string) => {
    const hideMessage = message.loading('Changing Tenant...', 10000);
    try {
      await api.accountsChangeTenant({
        accountId: user.userId,
        ChangeTenantPayload: {
          newTenantId,
        },
      });
      await refreshAccessToken();
      window.location.reload();
    } catch (e) {
      message.error('Failed to switch tenant');
    } finally {
      hideMessage();
    }
  };
  const handleChangeFeatures = async (newFeatures: Feature[]) => {
    setFeatures(newFeatures);
    const hideMessage = message.loading('Saving...');
    try {
      await api.postTenantsSettings({ TenantSettings: { features: newFeatures } });
      hideMessage();
      message.success('Saved');
    } catch (e) {
      hideMessage();
      message.error(e as Error);
    }
  };
  const showModal = () => {
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };

  return (
    <>
      <Button size="SMALL" onClick={showModal}>
        {user.tenantName}
      </Button>
      <Modal
        title="Super Admin Panel"
        footer={null}
        visible={isModalVisible}
        onCancel={handleCancel}
      >
        <Form<{ currentTenantId: string }>
          name="basic"
          labelCol={{ span: 8 }}
          wrapperCol={{ span: 16 }}
          onValuesChange={() => {}}
          initialValues={{ currentTenantId: user.tenantId }}
          autoComplete="off"
        >
          <Form.Item label="Tenant">
            <Select
              disabled={tenantOptions.length === 0}
              options={tenantOptions}
              onChange={handleChangeTenant}
              value={user.tenantId}
              filterOption={(input, option) =>
                (option?.label.toLowerCase() ?? '').includes(input.toLowerCase().trim()) ||
                (option?.value.toLowerCase() ?? '').includes(input.toLowerCase().trim())
              }
              showSearch={true}
            />
            <b>{`${user.tenantId}`}</b>
          </Form.Item>
          <Form.Item label="Features">
            <Select<Feature[]>
              mode="multiple"
              options={FEATURES.map((feature) => ({ label: feature, value: feature }))}
              onChange={handleChangeFeatures}
              allowClear
              disabled={!initialFeatures}
              value={features || initialFeatures}
            />
          </Form.Item>
        </Form>
        <Divider />
        <Button type="SECONDARY" size="SMALL" onClick={() => setShowCreateTenantModal(true)}>
          Create Tenant
        </Button>
      </Modal>
      <CreateTenantModal
        visible={showCreateTenantModal}
        onClose={() => setShowCreateTenantModal(false)}
      />
    </>
  );
}
