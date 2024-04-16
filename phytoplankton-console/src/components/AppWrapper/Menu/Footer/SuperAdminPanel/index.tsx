import { Divider, Input } from 'antd';
import React, { ChangeEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { validate } from 'uuid';
import NumberInput from '../../../../library/NumberInput';
import Label from '../../../../library/Label';
import { H4 } from '../../../../ui/Typography';
import { COLORS_V2_ALERT_CRITICAL } from '../../../../ui/colors';
import Checkbox from '../../../../library/Checkbox';
import { CreateTenantModal } from './CreateTenantModal';
import s from './styles.module.less';
import * as Card from '@/components/ui/Card';
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
import { DEFAULT_MERCHANT_MOITORING_LIMIT } from '@/utils/default-limits';
import { humanizeConstant } from '@/utils/humanize';
import { BATCH_JOB_NAMESS } from '@/apis/models-custom/BatchJobNames';
import Confirm from '@/components/utils/Confirm';
import { DOMAIN_BRANDING } from '@/utils/branding';
import Select from '@/components/library/Select';
import Tag from '@/components/library/Tag';

const featureDescriptions: Record<Feature, { title: string; description: string }> = {
  RISK_LEVELS: { title: 'Risk Levels', description: 'Enable risk levels' },
  RISK_SCORING: { title: ' Risk Scoring', description: 'Enables risk scoring' },
  AUDIT_LOGS: { title: 'Audit Logs', description: 'Enables audit log' },
  SLACK_ALERTS: { title: 'Slack Alerts', description: 'Enables slack alerts for cases' },
  NARRATIVE_COPILOT: {
    title: 'Narrative Copilot',
    description: 'Enables AI copilot feature in case management',
  },
  AI_FORENSICS: { title: 'AI Forensics', description: 'Enables AI forensics' },
  GOOGLE_SSO: { title: "Google SSO (Don't Use)", description: 'Enable google log in' },
  SANCTIONS: { title: 'Sanctions', description: 'Enables sanctions' },
  FALSE_POSITIVE_CHECK: {
    title: 'False Positive Check',
    description: 'Demo feature for false positive check',
  },
  DEMO_MODE: { title: 'Demo Mode', description: 'Enables demo mode' },
  DEMO_RULES: { title: 'Demo Rules', description: 'Enable demo rules, they don’t work actually' },
  SIMULATOR: { title: 'Simulator', description: 'Enables simulator for rules & risk levels' },
  CRM: { title: "CRM (Don't Use)", description: 'Enables CRM data' },
  ENTITY_LINKING: { title: 'Ontology', description: 'Enables Ontology (entity linking)' },
  ADVANCED_WORKFLOWS: { title: 'Advanced Workflows', description: 'Enables case escalations flow' },
  IBAN_RESOLUTION: {
    title: 'IBAN Resolution',
    description:
      'Resolve IBAN numbers from 3rd party website. Used in Certain Screening and Counterparty rules',
  },
  MERCHANT_MONITORING: {
    title: 'Merchant Monitoring',
    description: 'Enables merchant monitoring in users & case details',
  },
  SAR: { title: 'SAR', description: 'Enables SAR' },
  QA: { title: 'QA', description: 'Enables QA in case management' },
  AI_RISK_SCORE: {
    title: "AI Risk Score (Don't Use)",
    description: 'Enables AI risk score in Demo mode only',
  },
  RULES_ENGINE_V8: {
    title: 'Rules Engine V8',
    description: 'Enables new rules Engine V8 (Experimental)',
  },
  SYNC_TRS_CALCULATION: {
    title: 'Sync TRS Calculation',
    description: 'Allows to sync TRS calculation along with API call',
  },
  NOTIFICATIONS: {
    title: 'Notifications (In Development)',
    description: 'Enables notifications (currently in development)',
  },
};

export default function SuperAdminPanel() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [showCreateTenantModal, setShowCreateTenantModal] = useState(false);
  const settings = useSettings();
  const initialFeatures = useFeatures();
  const [features, setFeatures] = useState<Feature[] | undefined>(undefined);
  const [limits, setLimits] = useState<TenantSettings['limits']>(settings.limits || {});
  const [tenantIdToDelete, setTenantIdToDelete] = useState<string | undefined>(undefined);
  const [instantDelete, setInstantDelete] = useState<boolean>(false);

  const [complyAdvantageSearchProfileId, setSearchProfileId] = useState<string>(
    settings.complyAdvantageSearchProfileId || '',
  );

  const [batchJobName, setBatchJobName] = useState<BatchJobNames>('DEMO_MODE_DATA_LOAD');
  const user = useAuth0User();
  const api = useApi();
  const queryResult = useQuery(['tenants'], () => api.getTenantsList());
  const tenantOptions =
    queryResult.data?.map((tenant) => ({
      value: tenant.id,
      labelText: `${tenant.name} ${tenant.id} ${tenant.region}`,
      label: (
        <>
          {tenant.name} <Tag color="blue">id: {tenant.id} </Tag>
          {tenant.region && <Tag color="orange">region: {tenant.region} </Tag>}
        </>
      ),
      disabled: tenant.isProductionAccessDisabled ?? false,
    })) || [];

  const handleChangeTenant = async (newTenantId: string) => {
    if (user.tenantId === newTenantId) {
      return;
    }
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
      ...(features && { features }),
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
        <Label label="Tenant" testId="tenant-name">
          <Select
            isDisabled={tenantOptions.length === 0}
            options={tenantOptions}
            onChange={(v) => v && handleChangeTenant(v)}
            value={user.tenantId}
          />
          <div>
            Current tenant ID: <b>{`${user.tenantId}`}</b>
          </div>
        </Label>
        {role === 'root' && (
          <div className={s.rootSettingsContainer}>
            <br />
            <Button
              type="PRIMARY"
              size="MEDIUM"
              onClick={() => {
                setShowCreateTenantModal(true);
                handleCancel();
              }}
            >
              Create new tenant
            </Button>
            {['sandbox', 'prod'].includes(process.env.ENV_NAME as string) && (
              <Card.Root
                header={{ title: 'White-label tenants', titleSize: 'SMALL' }}
                isCollapsable={true}
                isCollapsedByDefault={true}
              >
                <Card.Section>
                  {Object.entries(DOMAIN_BRANDING).map(([url, config], i) => (
                    <a key={i} href={`https://${url}`}>{`${config.companyName} (${url})`}</a>
                  ))}
                </Card.Section>
              </Card.Root>
            )}
            <Divider />
            <Label
              label="Features"
              description="Enabled features of the tenant"
              testId="features-select"
            >
              <Select<Feature>
                mode="MULTIPLE"
                options={Object.keys(featureDescriptions).map((featureKey) => {
                  return {
                    label: featureDescriptions[featureKey].title,
                    value: featureKey as Feature,
                    title: featureDescriptions[featureKey].description,
                  };
                })}
                onChange={(v) => setFeatures(v ?? [])}
                allowClear
                isDisabled={!initialFeatures}
                value={features || initialFeatures}
              />
            </Label>
            <Label
              label="Simulation limit"
              description="The maximum number of simulations that can be run by a tenant."
            >
              <NumberInput
                value={limits?.simulations ?? 0}
                onChange={(value) => setLimits({ ...limits, simulations: value })}
                isDisabled={false}
              />
            </Label>
            <Label
              label="Max Seats"
              description="The maximum number of seats allowed for this tenant"
            >
              <NumberInput
                value={limits?.seats ?? 0}
                onChange={(value) => setLimits({ ...limits, seats: value })}
                isDisabled={false}
              />
            </Label>
            <Label
              label="Max ongoing merchant monitoring users"
              description="The maximum number of merchant monitoring users allowed for this tenant"
            >
              <NumberInput
                value={limits?.ongoingMerchantMonitoringUsers ?? DEFAULT_MERCHANT_MOITORING_LIMIT}
                onChange={(value) =>
                  setLimits({ ...limits, ongoingMerchantMonitoringUsers: value })
                }
                isDisabled={false}
              />
            </Label>
            <Label
              label="Maximum times api key can be viewed"
              description="The maximum number of times the api key can be viewed by a tenant"
            >
              <NumberInput
                value={limits?.apiKeyView ?? 0}
                onChange={(value) => setLimits({ ...limits, apiKeyView: value })}
                isDisabled={false}
              />
            </Label>
            <Button
              type="PRIMARY"
              isDanger
              onClick={() =>
                mutateTenantSettings.mutate({
                  apiKeyViewData: [],
                })
              }
            >
              Reset current API key view count
            </Button>
            <Label label="CA Search Profile ID">
              <Input
                value={complyAdvantageSearchProfileId}
                onChange={handleChangeSearchProfileID}
              />
            </Label>
            <Divider />
            <Label label="Run batch job">
              <Select
                options={BATCH_JOB_NAMESS.map((name) => ({
                  label: humanizeConstant(name),
                  value: name,
                }))}
                value={batchJobName}
                onChange={(v) => v && setBatchJobName(v)}
              />
            </Label>
            <Confirm
              title={`Run ${humanizeConstant(batchJobName)}?`}
              onConfirm={async () => {
                batchJobMessage = message.loading(`Starting ${humanizeConstant(batchJobName)}...`);
                try {
                  await api.postTenantsTriggerBatchJob({
                    TenantTriggerBatchJobRequest: {
                      jobName: batchJobName,
                    },
                  });
                  message.success(process.env.ENV_NAME === 'local' ? 'Done' : 'Submitted');
                } catch (e) {
                  message.error(e);
                } finally {
                  batchJobMessage();
                }
              }}
              text={`Are you sure you want to run ${humanizeConstant(batchJobName)} batch job?`}
              onSuccess={() => {
                batchJobMessage();
                message.success(`${humanizeConstant(batchJobName)} started`);
              }}
            >
              {(props) => (
                <Button isDisabled={!batchJobName} isDanger onClick={props.onClick}>
                  Run
                </Button>
              )}
            </Confirm>

            <Divider />
            {user.allowTenantDeletion && (
              <>
                <H4 style={{ color: COLORS_V2_ALERT_CRITICAL }}>Danger Zone</H4>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <Label
                    label="Tenant to delete"
                    description="Please go to the respective tenant region to delete the tenant (for example if tenant is in `us-1` region, go to `us-1` region you need to be in a different tenant then the tenant you want to delete)"
                  >
                    <Select
                      options={tenantOptions}
                      onChange={(value) => setTenantIdToDelete(value)}
                      value={tenantIdToDelete}
                      placeholder="Select tenant to delete"
                      style={{ width: '20rem' }}
                    />
                  </Label>
                  <Label label="Instant delete">
                    <Checkbox
                      value={instantDelete}
                      onChange={(value) => {
                        if (value != null) {
                          setInstantDelete(value);
                        }
                      }}
                    />
                  </Label>
                </div>
                <Confirm
                  title="Delete tenant?"
                  onConfirm={async () => {
                    batchJobMessage = message.loading(`Deleting tenant...`);
                    if (!tenantIdToDelete) {
                      message.error('No tenant selected');
                      return;
                    }

                    if (tenantIdToDelete === user.tenantId) {
                      message.error('Cannot delete current tenant');
                      return;
                    }

                    if (tenantIdToDelete?.includes('flagright')) {
                      message.error('Cannot delete tenant');
                      return;
                    }

                    try {
                      await api.deleteTenant({
                        DeleteTenant: {
                          tenantId: tenantIdToDelete,
                          notRecoverable: instantDelete,
                        },
                      });
                    } catch (e) {
                      message.error(
                        `Failed to delete tenant ${tenantIdToDelete}: Message: ${
                          (e as Error).message
                        }`,
                      );
                      batchJobMessage();
                      return;
                    }

                    batchJobMessage();
                    window.location.reload();
                  }}
                  text={`Are you sure you want to delete ${tenantIdToDelete} tenant?`}
                  onSuccess={() => {
                    batchJobMessage();
                    message.success(`${tenantIdToDelete} deleted`);
                  }}
                >
                  {(props) => (
                    <Button isDisabled={!tenantIdToDelete} isDanger onClick={props.onClick}>
                      Delete
                    </Button>
                  )}
                </Confirm>
              </>
            )}
          </div>
        )}
      </Modal>
      <CreateTenantModal
        visible={showCreateTenantModal}
        onClose={() => setShowCreateTenantModal(false)}
      />
    </>
  );
}
