import { Divider, Input, Space } from 'antd';
import React, { useMemo, useState } from 'react';
import { validate } from 'uuid';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import NumberInput from '../../../../library/NumberInput';
import Label from '../../../../library/Label';
import { H4 } from '../../../../ui/Typography';
import { COLORS_V2_ALERT_CRITICAL } from '../../../../ui/colors';
import Checkbox from '../../../../library/Checkbox';
import { CreateTenantModal } from './CreateTenantModal';
import s from './styles.module.less';
import { useQuery } from '@/utils/queries/hooks';
import Modal from '@/components/library/Modal';
import { message } from '@/components/library/Message';
import { useApi } from '@/api';
import Button from '@/components/library/Button';
import {
  BatchJobNames,
  Feature,
  SanctionsSettingsMarketType,
  Tenant,
  TenantSettings,
} from '@/apis';
import { clearAuth0LocalStorage, useAccountRole, useAuth0User } from '@/utils/user-utils';
import {
  useFeatureEnabled,
  useFeatures,
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import { DEFAULT_MERCHANT_MOITORING_LIMIT } from '@/utils/default-limits';
import { BATCH_JOB_NAMESS } from '@/apis/models-custom/BatchJobNames';
import Confirm from '@/components/utils/Confirm';
import { getWhiteLabelBrandingByHost, isWhiteLabeled } from '@/utils/branding';
import Select, { Option } from '@/components/library/Select';
import Tag from '@/components/library/Tag';
import { SANCTIONS_SETTINGS_MARKET_TYPES } from '@/apis/models-custom/SanctionsSettingsMarketType';
import SelectionGroup from '@/components/library/SelectionGroup';
import { isSuccess } from '@/utils/asyncResource';

const featureDescriptions: Record<Feature, { title: string; description: string }> = {
  RISK_LEVELS: { title: 'Risk levels', description: 'Enable risk levels' },
  RISK_SCORING: { title: ' Risk scoring', description: 'Enables risk scoring' },
  AUDIT_LOGS: { title: 'Audit logs', description: 'Enables audit log' },
  SLACK_ALERTS: { title: 'Slack alerts', description: 'Enables slack alerts for cases' },
  NARRATIVE_COPILOT: {
    title: 'Narrative copilot',
    description: 'Enables AI copilot feature in case management',
  },
  AI_FORENSICS: { title: 'AI forensics', description: 'Enables AI forensics' },
  GOOGLE_SSO: { title: "Google SSO (Don't Use)", description: 'Enable google log in' },
  SANCTIONS: { title: 'Screening', description: 'Enables screening' },
  FALSE_POSITIVE_CHECK: {
    title: 'False positive check',
    description: 'Demo feature for false positive check',
  },
  DEMO_MODE: { title: 'Demo mode', description: 'Enables demo mode' },
  DEMO_RULES: { title: 'Demo rules', description: 'Enable demo rules, they don’t work actually' },
  SIMULATOR: { title: 'Simulator', description: 'Enables simulator for rules & risk levels' },
  CRM: { title: "CRM (Don't Use)", description: 'Enables CRM data' },
  ENTITY_LINKING: { title: 'Ontology', description: 'Enables Ontology (entity linking)' },
  ADVANCED_WORKFLOWS: { title: 'Advanced workflows', description: 'Enables case escalations flow' },
  IBAN_RESOLUTION: {
    title: 'IBAN resolution',
    description:
      'Resolve IBAN numbers from 3rd party website. Used in Certain Screening and Counterparty rules',
  },
  MERCHANT_MONITORING: {
    title: 'Merchant monitoring',
    description: 'Enables merchant monitoring in users & case details',
  },
  SAR: { title: 'SAR', description: 'Enables SAR' },
  QA: { title: 'QA', description: 'Enables QA in case management' },
  RULES_ENGINE_V8: {
    title: 'Rules engine V8',
    description: 'Enables new rules Engine V8 (Experimental)',
  },
  NOTIFICATIONS: {
    title: 'Console notifications',
    description: 'Enables console notifications',
  },
  RULES_ENGINE_V8_FOR_V2_RULES: {
    title: 'Rules engine V8 for V2 Rules',
    description: 'Enables new rules Engine V8 for V2 rules (Experimental)',
  },
  FILES_AI_SUMMARY: {
    title: 'AI attachment summarization',
    description: 'Enables AI Attachment Summarization (pdf only)',
  },
  CLICKHOUSE_ENABLED: {
    title: 'Clickhouse (Beta)',
    description: 'Enables Clickhouse for data retrieval (Experimental)',
  },
  MACHINE_LEARNING: { title: 'Machine learning', description: 'Enables machine learning features' },
  ALERT_SLA: { title: 'Alerts SLA', description: 'Enables Alert SLA' },
  RISK_SCORING_V8: {
    title: 'Risk scoring V8',
    description: 'Enables risk scoring V8',
  },
  DOW_JONES: {
    title: 'Dow Jones',
    description: 'Enables using Dow Jones for sanctions',
  },
  ASYNC_RULES: {
    title: 'Async rules',
    description: 'Enables async rules',
  },
  RULES_ENGINE_V8_ASYNC_AGGREGATION: {
    title: 'Rules engine V8 async aggregation',
    description: 'Enables Rules engine V8 async aggregation',
  },
  PNB: {
    title: 'PNB',
    description: 'Enables PNB specific features',
  },
  MULTI_LEVEL_ESCALATION: {
    title: 'Multi Level Escalation',
    description: 'Enables multi level escalation',
  },
  SALES_RISK_SCORING: {
    title: 'Sales risk scoring',
    description: 'Enables access to both views of risk configuration.',
  },
  STRICT_FILE_SECURITY: {
    title: 'Strict file security',
    description:
      'Enables strict file security (forbid the following file extensions: .xlsx, .xlsm, .xltm)',
  },
  MANUAL_PRE_AGGREGATION: {
    title: 'Manual pre-aggregation',
    description: 'Enables manual pre-aggregation',
  },
  CONCURRENT_DYNAMODB_CONSUMER: {
    title: 'Concurrent DynamoDB consumer',
    description: 'Enables concurrent DynamoDB consumer',
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

  const isSanctionsEnabled = useFeatureEnabled('SANCTIONS');
  const isSanctionsToBeEnabled = isSanctionsEnabled || features?.includes('SANCTIONS');
  const [caSettings, setCaSettings] = useState(settings.sanctions);

  const [batchJobName, setBatchJobName] = useState<BatchJobNames>('DEMO_MODE_DATA_LOAD');
  const user = useAuth0User();
  const api = useApi();
  const queryResult = useQuery(['tenants'], () => api.getTenantsList(), {
    enabled: isModalVisible,
  });
  const tenants: Array<Tenant & { whitelabel?: { host: string; name: string } }> = useMemo(() => {
    if (isSuccess(queryResult.data)) {
      return (
        queryResult.data.value.map((tenant) => {
          const whitelabelBranding =
            !isWhiteLabeled() && tenant.host ? getWhiteLabelBrandingByHost(tenant.host) : undefined;
          return {
            ...tenant,
            whitelabel: whitelabelBranding
              ? { host: tenant.host as string, name: whitelabelBranding.companyName }
              : undefined,
          };
        }) ?? []
      );
    }
    return [];
  }, [queryResult.data]);
  const tenantOptions: Option<string>[] = useMemo(
    () =>
      tenants.map((tenant) => {
        const tags = [
          <Tag key="id" color="blue">
            id: {tenant.id}
          </Tag>,
          <Tag key="region" color="orange">
            region: {tenant.region || 'eu-1'}
          </Tag>,
          !isWhiteLabeled() && tenant.whitelabel && (
            <Tag key="whitelabel" color="cyan">
              white-label: {tenant.whitelabel.name}
            </Tag>
          ),
        ];

        const option: Option<string> = {
          value: tenant.id,
          label: (
            <Space>
              {tenant.name} {tags} {tenant.isProductionAccessDisabled ? '🔒' : ''}
            </Space>
          ),
          isDisabled:
            user.allowedRegions?.length && !user.allowedRegions.includes(tenant.region || '')
              ? true
              : false,
          labelText: `${tenant.name} ${tenant.id} ${tenant.region} ${tenant.whitelabel?.name}`,
        };

        return option;
      }),
    [tenants, user.allowedRegions],
  );

  const handleChangeTenant = async (newTenantId: string) => {
    if (user.tenantId === newTenantId) {
      return;
    }
    const tenant = tenants.find((t) => t.id === newTenantId);
    if (tenant?.whitelabel) {
      window.open(`https://${tenant.whitelabel.host}`, '_blank');
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

  const tenantsDeletionQueryResult = useQuery(['tenantsFailedToDelete'], async () => {
    return await api.getTenantsDeletionData();
  });

  const { tenantsDeletedRecently, tenantsFailedToDelete, tenantsMarkedForDelete } = useMemo(() => {
    if (isSuccess(tenantsDeletionQueryResult.data)) {
      return tenantsDeletionQueryResult.data.value;
    }
    return {};
  }, [tenantsDeletionQueryResult.data]);
  const mutateTenantSettings = useUpdateTenantSettings();
  const handleSave = async () => {
    // Sanctions settings validation
    if (isSanctionsToBeEnabled) {
      if (!caSettings?.marketType) {
        message.fatal('ComplyAdvantage market type must be set');
        return;
      }
      if (
        caSettings?.customSearchProfileId &&
        caSettings.customSearchProfileId.length > 0 &&
        !validate(caSettings.customSearchProfileId)
      ) {
        message.fatal('Comply Advantage Search profile ID must be a valid UUID');
        return;
      }
    }
    mutateTenantSettings.mutate({
      ...(features && { features }),
      ...(limits && { limits }),
      sanctions: caSettings,
    });
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

            {tenantsDeletedRecently?.length ? (
              <Label
                label={`Tenants recently deleted in last 30 days (${tenantsDeletedRecently.length})`}
              >
                <Space direction={'horizontal'} wrap={true}>
                  {tenantsDeletedRecently.map((tenant) => (
                    <Tag color={'success'}>
                      {tenant.tenantName} ({tenant.tenantId})
                    </Tag>
                  ))}
                </Space>
              </Label>
            ) : (
              <></>
            )}
            {tenantsMarkedForDelete?.length ? (
              <Label label={`Tenants marked for delete (${tenantsMarkedForDelete.length})`}>
                <Space direction={'horizontal'} wrap={true}>
                  {tenantsMarkedForDelete.map((tenant) => (
                    <Tag color={'warning'}>
                      {tenant.tenantName} ({tenant.tenantId})
                    </Tag>
                  ))}
                </Space>
              </Label>
            ) : (
              <></>
            )}
            {tenantsFailedToDelete?.length ? (
              <Label label={`Tenants failed to delete (${tenantsFailedToDelete.length})`}>
                <Space direction={'horizontal'} wrap={true}>
                  {tenantsFailedToDelete.map((tenant) => (
                    <Tag color={'error'}>
                      {tenant.tenantName} ({tenant.tenantId})
                    </Tag>
                  ))}
                </Space>
              </Label>
            ) : (
              <></>
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
              description="The maximum number of simulations that can be run by a tenant"
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
            {isSanctionsToBeEnabled && (
              <Label label="ComplyAdvantage settings">
                <Label level={2} label="Market type" required={{ value: true, showHint: true }}>
                  <SelectionGroup
                    value={caSettings?.marketType}
                    onChange={(v) => {
                      setCaSettings({
                        ...caSettings,
                        marketType: v as SanctionsSettingsMarketType,
                      });
                    }}
                    mode={'SINGLE'}
                    options={SANCTIONS_SETTINGS_MARKET_TYPES.map((v) => ({
                      label: humanizeConstant(v),
                      value: v,
                    }))}
                  />
                </Label>
                <Label
                  level={2}
                  label="Custom search profile ID"
                  description="If being set, we'll only use this search profile ID for ComplyAdvantage searches, and users won't be able to select different search types"
                >
                  <Input
                    value={caSettings?.customSearchProfileId}
                    onChange={(event) => {
                      setCaSettings({
                        ...caSettings,
                        marketType: caSettings?.marketType ?? 'EMERGING',
                        customSearchProfileId: event.target.value.trim(),
                      });
                    }}
                  />
                </Label>
              </Label>
            )}
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
                <br />
                <Confirm
                  title={`${settings.isAccountSuspended ? 'Unsuspend' : 'Suspend'} tenant: ${
                    user.tenantName
                  } (${user.tenantId})`}
                  onConfirm={async () => {
                    mutateTenantSettings.mutate({
                      isAccountSuspended: !(settings.isAccountSuspended ?? false),
                    });
                  }}
                  text={`Are you sure you want to ${
                    settings.isAccountSuspended ? 'unsuspend' : 'suspend'
                  } tenant: ${user.tenantName} (${user.tenantId})?`}
                  onSuccess={() => {
                    message.success(
                      `${user.tenantName} (${user.tenantId}) ${
                        settings.isAccountSuspended ? 'unsuspended' : 'suspended'
                      }`,
                    );
                  }}
                >
                  {(props) => (
                    <Button isDanger type="TETRIARY" onClick={props.onClick}>
                      {settings.isAccountSuspended ? 'Unsuspend' : 'Suspend'} account
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
