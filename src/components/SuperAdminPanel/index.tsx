import { Alert, Form, message, Modal, Select } from 'antd';
import { useEffect, useState } from 'react';
import { useApi } from '@/api';
import Button from '@/components/ui/Button';
import {
  AsyncResource,
  failed,
  init,
  isFailed,
  isSuccess,
  loading,
  match,
  success,
} from '@/utils/asyncResource';
import { Feature, Tenant } from '@/apis';
import { useAuth0User } from '@/utils/user-utils';
import { useFeatures } from '@/components/AppWrapper/Providers/SettingsProvider';

const FEATURES: Feature[] = [
  'PULSE',
  'PULSE_MANUAL_USER_RISK_LEVEL',
  'PULSE_KRS_CALCULATION',
  'PULSE_ARS_CALCULATION',
  'SLACK_ALERTS',
  'AUDIT_LOGS',
  'IMPORT_FILES',
  'LISTS',
  'CASE_CREATION_TYPE',
  'HELP_CENTER',
  'SANCTIONS',
];

export default function SuperAdminPanel() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const initialFeatures = useFeatures();
  const [features, setFeatures] = useState<Feature[] | undefined>(undefined);
  const user = useAuth0User();

  const [tenantsRes, setTenantsRes] = useState<AsyncResource<Tenant[]>>(init());

  const api = useApi();
  useEffect(() => {
    async function fetch() {
      setTenantsRes(loading());
      try {
        const tenants = await api.getTenantsList();
        setTenantsRes(success(tenants));
      } catch (e) {
        setTenantsRes(failed(e instanceof Error ? e.message : 'Unknown error'));
      }
    }
    fetch().catch((e) => {
      console.log('e', e);
    });
  }, [api]);

  const [changeTenantRes, setChangeTenantRes] = useState<AsyncResource<void>>(init());

  const handleChangeTenant = async (newTenantId: string) => {
    setChangeTenantRes(loading());
    const hideMessage = message.loading('Changing Tenant...', 10000);
    try {
      await api.accountsChangeTenant({
        accountId: user.userId,
        ChangeTenantPayload: {
          newTenantId,
        },
      });
      setChangeTenantRes(success(undefined));
      window.location.reload();
    } catch (e) {
      setChangeTenantRes(failed(e instanceof Error ? e.message : 'Unknown error'));
    } finally {
      hideMessage();
    }
  };
  const handleChangeFeatures = async (newFeatures: Feature[]) => {
    setFeatures(newFeatures);
    const hideMessage = message.loading('Saving...', 0);
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

  const tenantOptions = match(tenantsRes, {
    init: () => [],
    success: (value) =>
      value.map(({ id, name }) => ({
        value: id,
        label: name,
      })),
    loading: () => [{ value: '', label: `Loading...` }],
    failed: (message) => [{ value: '', label: `Unable to load tenant list: ${message}` }],
  });

  return (
    <>
      <Button type="default" size="small" onClick={showModal}>
        Super Admin
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
              disabled={!isSuccess(tenantsRes)}
              options={tenantOptions}
              onChange={handleChangeTenant}
              value={user.tenantId}
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
          {isFailed(changeTenantRes) && <Alert message={changeTenantRes.message} type="error" />}
        </Form>
      </Modal>
    </>
  );
}
