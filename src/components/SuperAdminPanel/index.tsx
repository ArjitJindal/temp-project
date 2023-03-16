import { Divider, Form, Input, message, Modal, Select } from 'antd';
import React, { ChangeEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { validate } from 'uuid';
import Label from '../library/Label';
import NumberInput from '../library/NumberInput';
import { CreateTenantModal } from './CreateTenantModal';
import { useApi } from '@/api';
import Button from '@/components/library/Button';
import { Feature, TenantSettings } from '@/apis';
import { useAuth0User } from '@/utils/user-utils';
import { useFeatures, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import ButtonGroup from '@/components/library/ButtonGroup';

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
  const settings = useSettings();
  const [maxSeats, setMaxSeats] = useState<number | undefined>(settings.limits?.seats);
  const initialFeatures = useFeatures();
  const [features, setFeatures] = useState<Feature[] | undefined>(undefined);
  const [complyAdvantageSearchProfileId, setSearchProfileId] = useState<string>(
    settings.complyAdvantageSearchProfileId || '',
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
    const hideMessage = message.loading('Changing Tenant...', 10000);
    try {
      await api.accountsChangeTenant({
        accountId: user.userId,
        ChangeTenantPayload: {
          newTenantId,
        },
      });
      window.location.reload();
    } catch (e) {
      message.error('Failed to switch tenant');
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
      message.error(e as Error);
    }
  };
  const handleSave = async () => {
    if (complyAdvantageSearchProfileId.length > 0 && !validate(complyAdvantageSearchProfileId)) {
      message.error('Comply Advantage Search profile ID must be a valid UUID');
      return;
    }
    await updateTenantSettings({ features, complyAdvantageSearchProfileId });
  };
  const handleChangeFeatures = async (newFeatures: Feature[]) => {
    setFeatures(newFeatures);
    await updateTenantSettings({ features: newFeatures });
  };
  const handleChangeSearchProfileID = async (event: ChangeEvent<HTMLInputElement>) => {
    setSearchProfileId(event.target.value.trim());
  };

  const showModal = () => {
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };

  const handleMaxSeats = async (newMaxSeats: number) => {
    const hideMessage = message.loading('Saving...');
    try {
      await api.postTenantsSettings({ TenantSettings: { limits: { seats: newMaxSeats } } });
      hideMessage();
      message.success('Saved');
    } catch (e) {
      hideMessage();
      message.error(e as Error);
    }
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
        <Form<{ currentTenantId: string; searchProfileId: string }>
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
          <Label
            label="Max Seats"
            description="The maximum number of seats allowed for this tenant"
            element="div"
          >
            <NumberInput
              value={maxSeats}
              onChange={(value) => setMaxSeats(value)}
              isDisabled={false}
            />
          </Label>
          <Button
            type="PRIMARY"
            size="SMALL"
            onClick={() => {
              if (maxSeats) {
                handleMaxSeats(maxSeats);
              }
            }}
            style={{
              marginTop: 8,
            }}
          >
            Save
          </Button>
          <Form.Item label="CA Search Profile ID">
            <Input value={complyAdvantageSearchProfileId} onChange={handleChangeSearchProfileID} />
          </Form.Item>
        </Form>
        <Divider />
        <ButtonGroup>
          <Button type="PRIMARY" size="SMALL" onClick={handleSave}>
            Save
          </Button>
          <Button type="SECONDARY" size="SMALL" onClick={() => setShowCreateTenantModal(true)}>
            Create Tenant
          </Button>
        </ButtonGroup>
      </Modal>
      <CreateTenantModal
        visible={showCreateTenantModal}
        onClose={() => setShowCreateTenantModal(false)}
      />
    </>
  );
}
