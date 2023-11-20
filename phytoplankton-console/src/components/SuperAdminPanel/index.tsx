import { Divider, Input, Select, Tag } from 'antd';
import { ChangeEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { validate } from 'uuid';
import NumberInput from '../library/NumberInput';
import Label from '../library/Label';
import { H4 } from '../ui/Typography';
import { CreateTenantModal } from './CreateTenantModal';
import s from './styles.module.less';
import Modal from '@/components/library/Modal';
import { message } from '@/components/library/Message';
import { useApi } from '@/api';
import Button from '@/components/library/Button';
import { BatchJobNames, Feature, TenantSettings } from '@/apis';
import { clearAuth0LocalStorage, useAccountRole, useAuth0User } from '@/utils/user-utils';
import {
  useFeatures,
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import { FEATURES } from '@/apis/models-custom/Feature';
import { DEFAULT_MERCHANT_MOITORING_LIMIT } from '@/utils/default-limits';
import { humanizeConstant } from '@/utils/humanize';
import { BATCH_JOB_NAMESS } from '@/apis/models-custom/BatchJobNames';
import Confirm from '@/components/utils/Confirm';

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

  const [batchJobName, setBatchJobName] = useState<string>('');
  const user = useAuth0User();
  const api = useApi();
  const queryResult = useQuery(['tenants'], () => api.getTenantsList());
  const tenantOptions =
    queryResult.data?.map((tenant) => ({
      value: tenant.id,
      text: `${tenant.name} ${tenant.id} ${tenant.region}`,
      label: (
        <div data-cy={tenant.name}>
          {tenant.name} <Tag color="blue">id: {tenant.id} </Tag>
          {tenant.region && <Tag color="orange">region: {tenant.region} </Tag>}
        </div>
      ),
      disabled: tenant.isProductionAccessDisabled ?? false,
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
      clearAuth0LocalStorage();
      window.location.reload();
    } catch (e) {
      message.fatal('Failed to switch tenant', e);
    } finally {
      hideMessage();
    }
  };

  const mutateTenantSettings = useUpdateTenantSettings();
  const handleSave = async () => {
    if (complyAdvantageSearchProfileId.length > 0 && !validate(complyAdvantageSearchProfileId)) {
      message.fatal('Comply Advantage Search profile ID must be a valid UUID');
      return;
    }
    mutateTenantSettings.mutate({
      ...(features && features.length && { features }),
      ...(limits && { limits }),
      ...(complyAdvantageSearchProfileId && { complyAdvantageSearchProfileId }),
    });
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

  let batchJobMessage;
  const role = useAccountRole();

  return (
    <>
      <Button size="SMALL" onClick={showModal} testName="superadmin-panel-button">
        {user.tenantName}
      </Button>
      <Modal
        title="Super admin panel"
        width="L"
        isOpen={isModalVisible}
        okText={role === 'root' ? 'Save' : undefined}
        onCancel={handleCancel}
        onOk={role === 'root' ? handleSave : undefined}
      >
        <Label label="Tenant">
          <Select
            disabled={tenantOptions.length === 0}
            options={tenantOptions}
            onChange={handleChangeTenant}
            value={user.tenantId}
            filterOption={(input, option) =>
              (option?.text?.toLowerCase() ?? '').includes(input.toLowerCase().trim())
            }
            showSearch={true}
          />
          <div>
            Current tenant ID: <b>{`${user.tenantId}`}</b>
          </div>
        </Label>
        {role === 'root' && (
          <>
            <br />
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
              <Label
                label="Max ongoing merchant monitoring users"
                description="The maximum number of merchant monitoring users allowed for this tenant"
                element="div"
              >
                <NumberInput
                  value={limits?.ongoingMerchantMonitoringUsers ?? DEFAULT_MERCHANT_MOITORING_LIMIT}
                  onChange={(value) =>
                    setLimits({ ...limits, ongoingMerchantMonitoringUsers: value })
                  }
                  isDisabled={false}
                />
              </Label>
            </div>
            <div className={s.field}>
              <Label
                label="Maximum times api key can be viewed"
                description="The maximum number of times the api key can be viewed by a tenant"
                element="div"
              >
                <NumberInput
                  value={limits?.apiKeyView ?? 0}
                  onChange={(value) => setLimits({ ...limits, apiKeyView: value })}
                  isDisabled={false}
                />
              </Label>
            </div>
            <div className={s.field}>
              <Button
                type="PRIMARY"
                onClick={() =>
                  mutateTenantSettings.mutate({
                    apiKeyViewData: [],
                  })
                }
              >
                Reset Current API Key View Count
              </Button>
            </div>
            <div className={s.field}>
              <Label label="CA Search Profile ID">
                <Input
                  value={complyAdvantageSearchProfileId}
                  onChange={handleChangeSearchProfileID}
                />
              </Label>
            </div>
            <Divider />
            <H4>Run Batch Jobs</H4>
            <div className={s.field}>
              <Label label="Job Name">
                <Select
                  options={BATCH_JOB_NAMESS.map((name) => ({
                    label: humanizeConstant(name),
                    value: name,
                  }))}
                  value={batchJobName}
                  onChange={setBatchJobName}
                  allowClear
                  onClear={() => setBatchJobName('')}
                  showSearch
                />
              </Label>
            </div>
            <Confirm
              title={`Run ${humanizeConstant(batchJobName)}?`}
              onConfirm={async () => {
                batchJobMessage = message.loading(`Starting ${humanizeConstant(batchJobName)}...`);
                await api.postTenantsTriggerBatchJob({
                  TenantTriggerBatchJobRequest: {
                    jobName: batchJobName as BatchJobNames,
                  },
                });
                batchJobMessage();
                window.location.reload();
              }}
              text={`Are you sure you want to run ${humanizeConstant(batchJobName)} batch job?`}
              onSuccess={() => {
                batchJobMessage();
                message.success(`${humanizeConstant(batchJobName)} started`);
              }}
            >
              {(props) => (
                <div className={s.field}>
                  <Button isDisabled={!batchJobName} onClick={props.onClick}>
                    Run
                  </Button>
                </div>
              )}
            </Confirm>
          </>
        )}
      </Modal>
      <CreateTenantModal
        visible={showCreateTenantModal}
        onClose={() => setShowCreateTenantModal(false)}
      />
    </>
  );
}
