import { Divider, Form, Input, Select } from 'antd';
import React, { ChangeEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { validate } from 'uuid';
import NumberInput from '../library/NumberInput';
import Label from '../library/Label';
import Modal from '../ui/Modal';
import { CreateTenantModal } from './CreateTenantModal';
import s from './styles.module.less';
import { message } from '@/components/library/Message';
import { useApi } from '@/api';
import Button from '@/components/library/Button';
import { Feature, TenantSettings } from '@/apis';
import { useAuth0User } from '@/utils/user-utils';
import { useFeatures, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { FEATURES } from '@/apis/models-custom/Feature';

export default function SuperAdminPanel() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [showCreateTenantModal, setShowCreateTenantModal] = useState(false);
  const settings = useSettings();
  const initialFeatures = useFeatures();
  const [features, setFeatures] = useState<Feature[] | undefined>(undefined);
  const [limits, setLimits] = useState<TenantSettings['limits']>(settings.limits || {});

  const [complyAdvantageSearchProfileId, setSearchProfileId] = useState<string>(
    settings.complyAdvantageSearchProfileId || '',
  );
  const [salesforceAuthToken, setSalesforceAuthToken] = useState<string>(
    settings.salesforceAuthToken || '',
  );
  const user = useAuth0User();
  const api = useApi();
  const queryResult = useQuery(['tenants'], () => api.getTenantsList());
  const tenantOptions =
    queryResult.data?.map((tenant) => ({
      value: tenant.id,
      label: tenant.name,
    })) || [];

  const handleChangeTenant = async (newTenantId: string) => {
    const unsetDemoMode = api.accountChangeSettings({
      accountId: user.userId,
      AccountSettings: {
        demoMode: false,
      },
    });
    const hideMessage = message.loading('Changing Tenant...');
    try {
      await api.accountsChangeTenant({
        accountId: user.userId,
        ChangeTenantPayload: {
          newTenantId,
        },
      });
      await unsetDemoMode;
      window.location.reload();
    } catch (e) {
      message.fatal('Failed to switch tenant', e);
    } finally {
      hideMessage();
    }
  };

  const updateTenantSettings = async (TenantSettings: Partial<TenantSettings>) => {
    const hideMessage = message.loading('Saving...');
    try {
      await api.postTenantsSettings({ TenantSettings });
      hideMessage();
      message.success('Saved');
    } catch (e) {
      hideMessage();
      message.fatal('Failed to save tenant settings', e);
    }
  };

  const handleSave = async () => {
    if (complyAdvantageSearchProfileId.length > 0 && !validate(complyAdvantageSearchProfileId)) {
      message.fatal('Comply Advantage Search profile ID must be a valid UUID');
      return;
    }
    await updateTenantSettings({
      ...(features && features.length && { features }),
      ...(limits && { limits }),
      ...(complyAdvantageSearchProfileId && { complyAdvantageSearchProfileId }),
      ...(salesforceAuthToken && { salesforceAuthToken }),
    });
  };

  const handleChangeSearchProfileID = async (event: ChangeEvent<HTMLInputElement>) => {
    setSearchProfileId(event.target.value.trim());
  };

  const handleChangeSalesforceAuthToken = async (event: ChangeEvent<HTMLInputElement>) => {
    setSalesforceAuthToken(event.target.value.trim());
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
        width="80%"
        isOpen={isModalVisible}
        okText="Save"
        okProps={{ danger: true }}
        onCancel={handleCancel}
        onOk={handleSave}
        style={{ top: 20 }}
      >
        <Form<{ currentTenantId: string; searchProfileId: string }>
          name="basic"
          initialValues={{ currentTenantId: user.tenantId }}
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
            Tenant ID: <b>{`${user.tenantId}`}</b>
          </Form.Item>
        </Form>
        <Button
          type="SECONDARY"
          size="SMALL"
          onClick={() => {
            setShowCreateTenantModal(true);
            handleCancel();
          }}
        >
          Create New Tenant
        </Button>
        <Divider />
        <div className={s.field}>
          <Label label="Features" description="Enabled features of the tenant" element="div">
            <Select<Feature[]>
              mode="multiple"
              options={FEATURES.map((feature) => ({ label: feature, value: feature }))}
              onChange={setFeatures}
              allowClear
              disabled={!initialFeatures}
              value={features || initialFeatures}
            />
          </Label>
        </div>
        <div className={s.field}>
          <Label
            label="Simulation limit"
            description="The maximum number of simulations that can be run by a tenant."
            element="div"
          >
            <NumberInput
              value={limits?.simulations ?? 0}
              onChange={(value) => setLimits({ ...limits, simulations: value })}
              isDisabled={false}
            />
          </Label>
        </div>
        <div className={s.field}>
          <Label
            label="Max Seats"
            description="The maximum number of seats allowed for this tenant"
            element="div"
          >
            <NumberInput
              value={limits?.seats ?? 0}
              onChange={(value) => setLimits({ ...limits, seats: value })}
              isDisabled={false}
            />
          </Label>
        </div>
        <div className={s.field}>
          <Label label="CA Search Profile ID">
            <Input value={complyAdvantageSearchProfileId} onChange={handleChangeSearchProfileID} />
          </Label>
        </div>
        <div className={s.field}>
          <Label label="Salesforce Auth Token">
            <Input value={salesforceAuthToken} onChange={handleChangeSalesforceAuthToken} />
          </Label>
        </div>
      </Modal>
      <CreateTenantModal
        visible={showCreateTenantModal}
        onClose={() => setShowCreateTenantModal(false)}
      />
    </>
  );
}
