import { useMemo, useState } from 'react';
import { validate } from 'uuid';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import NumberInput from '../../../../library/NumberInput';
import Label from '../../../../library/Label';
import TextInput from '../../../../library/TextInput';
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
  CrmIntegrationNames,
  Feature,
  SanctionsSettingsMarketType,
  Tenant,
  TenantData,
  TenantSettings,
} from '@/apis';
import { clearAuth0LocalStorage, useAccountRole, useAuth0User } from '@/utils/user-utils';
import {
  useFeatures,
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import { BATCH_JOB_NAMESS } from '@/apis/models-custom/BatchJobNames';
import Confirm from '@/components/utils/Confirm';
import { getWhiteLabelBrandingByHost, isWhiteLabeled } from '@/utils/branding';
import Select, { Option } from '@/components/library/Select';
import Tag from '@/components/library/Tag';
import { SANCTIONS_SETTINGS_MARKET_TYPES } from '@/apis/models-custom/SanctionsSettingsMarketType';
import SelectionGroup from '@/components/library/SelectionGroup';
import { isSuccess } from '@/utils/asyncResource';
import ExpandContainer from '@/components/utils/ExpandContainer';
import ExpandIcon from '@/components/library/ExpandIcon';
import { CRM_INTEGRATION_NAMESS } from '@/apis/models-custom/CrmIntegrationNames';
import { useSARReportCountries } from '@/components/Sar/utils';

export enum FeatureTag {
  ENG = 'Eng',
  WIP = 'WIP',
}

export const featureDescriptions: Record<
  Feature,
  { title: string; description: string; tag?: FeatureTag }
> = {
  ALERT_DETAILS_PAGE: {
    title: 'Alert details page',
    description: 'Enable showing alert details on a separate page',
    tag: FeatureTag.WIP,
  },
  RISK_LEVELS: { title: 'Risk levels', description: 'Enable risk levels' },
  RISK_SCORING: { title: ' Risk scoring', description: 'Enables risk scoring' },
  SLACK_ALERTS: { title: 'Slack alerts', description: 'Enables slack alerts for cases' },
  NARRATIVE_COPILOT: {
    title: 'Narrative copilot',
    description: 'Enables AI copilot feature in case management',
  },
  AI_FORENSICS: { title: 'AI forensics', description: 'Enables AI forensics' },
  SANCTIONS: { title: 'Screening', description: 'Enables screening' },
  FALSE_POSITIVE_CHECK: {
    title: 'False positive check',
    description: 'Demo feature for false positive check',
  },
  DEMO_MODE: { title: 'Demo mode', description: 'Enables demo mode' },
  SIMULATOR: { title: 'Simulator', description: 'Enables simulator for rules & risk levels' },
  CRM: {
    title: 'CRM (Demo use only)',
    description: 'Enables CRM data Freshdesk Nango integration',
  },
  ENTITY_LINKING: { title: 'Ontology', description: 'Enables Ontology (entity linking)' },
  ADVANCED_WORKFLOWS: { title: 'Advanced workflows', description: 'Enables case escalations flow' },
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
    tag: FeatureTag.WIP,
  },
  FILES_AI_SUMMARY: {
    title: 'AI attachment summarization',
    description: 'Enables AI Attachment Summarization (pdf only)',
  },
  CLICKHOUSE_ENABLED: {
    title: 'Clickhouse (Beta)',
    description: 'Enables Clickhouse for data retrieval (Experimental)',
  },
  CLICKHOUSE_MIGRATION: {
    title: 'Clickhouse Migration',
    description: 'Enables Clickhouse Migration',
    tag: FeatureTag.WIP,
  },
  MACHINE_LEARNING: { title: 'Machine learning', description: 'Enables machine learning features' },
  ALERT_SLA: { title: 'Alerts SLA', description: 'Enables Alert SLA' },
  DOW_JONES: {
    title: 'Dow Jones',
    description: 'Enables using Dow Jones for sanctions',
  },
  OPEN_SANCTIONS: {
    title: 'Open sanctions',
    description: 'Enables using Open sanctions for sanctions',
  },
  ACURIS: {
    title: 'Acuris',
    description: 'Enables using Acuris for sanctions',
  },
  ASYNC_RULES: {
    title: 'Async rules',
    description: 'Enables async rules',
  },
  CONCURRENT_ASYNC_RULES: {
    title: 'Concurrent async rules',
    description: 'Enables concurrent async rules',
    tag: FeatureTag.ENG,
  },
  RULES_ENGINE_V8_SYNC_REBUILD: {
    title: 'Rules engine V8 sync rebuild ',
    description: 'Enables Rules engine V8 sync rebuild',
    tag: FeatureTag.ENG,
  },
  PNB: {
    title: 'PNB',
    description: 'Enables PNB specific features',
  },
  PNB_DAY_2: {
    title: 'PNB Day 2',
    description: 'Enables PNB Day 2 specific features',
  },
  NEW_FEATURES: {
    title: 'New features',
    description:
      'Enables new features (Specifically for ALL Customers but hidden because of the PNB)',
  },
  MULTI_LEVEL_ESCALATION: {
    title: 'Multi Level Escalation',
    description: 'Enables multi level escalation',
  },
  STRICT_FILE_SECURITY: {
    title: 'Strict file security',
    description:
      'Enables strict file security (forbid the following file extensions: .xlsx, .xlsm, .xltm)',
  },
  MANUAL_PRE_AGGREGATION: {
    title: 'Manual pre-aggregation',
    description: 'Enables manual pre-aggregation',
    tag: FeatureTag.ENG,
  },
  MANUAL_DASHBOARD_REFRESH: {
    title: 'Manual dashboard refresh',
    description: 'Enables manual dashboard refresh (dashboard will not auto-refresh)',
    tag: FeatureTag.ENG,
  },
  CONCURRENT_DYNAMODB_CONSUMER: {
    title: 'Concurrent DynamoDB consumer',
    description: 'Enables concurrent DynamoDB consumer',
    tag: FeatureTag.ENG,
  },
  '314A': {
    title: '314A',
    description: 'Enables 314A',
    tag: FeatureTag.ENG,
  },
  CHAINALYSIS: {
    title: 'Chainalysis',
    description: 'Enables Chainalysis',
    tag: FeatureTag.ENG,
  },
  WORKFLOWS_BUILDER: {
    title: 'Workflows builder',
    description: 'Enables workflows builder',
    tag: FeatureTag.WIP,
  },
  TRANSLITERATION: {
    title: "Transliteration (Don't use)",
    description: 'Enables transliteration for screening',
    tag: FeatureTag.ENG,
  },
  OPEN_SEARCH: {
    title: 'Opensearch',
    description: 'Enables opensearch for screening searches',
    tag: FeatureTag.ENG,
  },
};

export default function SuperAdminPanel() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [showCreateTenantModal, setShowCreateTenantModal] = useState(false);
  const settings = useSettings();
  const initialFeatures = useFeatures();
  const [features, setFeatures] = useState<Feature[] | undefined>(settings.features?.sort());
  const [limits, setLimits] = useState<TenantSettings['limits']>(settings.limits || {});
  const [tenantIdToDelete, setTenantIdToDelete] = useState<string | undefined>(undefined);
  const [instantDelete, setInstantDelete] = useState<boolean>(false);
  const [containerCollapssed, setContainerCollapssed] = useState<{
    deletionContainer: boolean;
    markedForDeletionContainer: boolean;
    failedToDeleteContainer: boolean;
  }>({
    deletionContainer: true,
    markedForDeletionContainer: true,
    failedToDeleteContainer: true,
  });
  const [downloadFeatureLoading, setDownloadFeatureState] = useState(false);

  const isDowJonesToBeEnabled = features?.includes('DOW_JONES');
  const hasExternalSanctionsProvider =
    features?.includes('ACURIS') ||
    features?.includes('OPEN_SANCTIONS') ||
    features?.includes('DOW_JONES');
  const isSanctionsToBeEnabled = features?.includes('SANCTIONS');
  const isCrmToBeEnabled = features?.includes('CRM');
  const isSARToBeEnabled = features?.includes('SAR');
  const [sanctionsSettings, setSanctionsSettings] = useState(settings.sanctions);

  const SARCountries = useSARReportCountries(true);
  const [batchJobName, setBatchJobName] = useState<BatchJobNames>('DEMO_MODE_DATA_LOAD');
  const [crmIntegrationName, setCrmIntegrationName] = useState<CrmIntegrationNames | undefined>(
    settings.crmIntegrationName ?? undefined,
  );
  const [sarJurisdictions, setSarJurisdictions] = useState<Array<string>>(
    settings.sarJurisdictions ?? [],
  );

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
            <div className={s.horizontalSpace}>
              {tenant.name} {tags} {tenant.isProductionAccessDisabled ? '🔒' : ''}
            </div>
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

  const handleContainerCollapse = (
    container: 'deletionContainer' | 'markedForDeletionContainer' | 'failedToDeleteContainer',
  ) => {
    setContainerCollapssed((prev) => ({ ...prev, [container]: !prev[container] }));
  };
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

  const handlePullAllTenantsFeatures = async () => {
    const features = await api.getTenantsFeatures();

    const csvContent =
      `Tenant ID, Tenant Name, Region, ${Object.entries(featureDescriptions)
        .map(([_, value]) => value.title)
        .join(',')}\n` +
      // if feature is enabled, add Y, otherwise add N
      features
        .map(
          (feature) =>
            `${feature.tenantId},${feature.tenantName},${feature.region},${Object.entries(
              featureDescriptions,
            )
              .map(([featureKey]) => (feature.features.includes(featureKey as Feature) ? 'Y' : 'N'))
              .join(',')}`,
        )
        .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `tenant_features-${new Date().toISOString()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
      if (!hasExternalSanctionsProvider && !sanctionsSettings?.marketType) {
        message.fatal('ComplyAdvantage market type must be set');
        return;
      }
      if (
        sanctionsSettings?.customSearchProfileId &&
        sanctionsSettings.customSearchProfileId.length > 0 &&
        !validate(sanctionsSettings.customSearchProfileId)
      ) {
        message.fatal('Comply Advantage Search profile ID must be a valid UUID');
        return;
      }
    }
    mutateTenantSettings.mutate({
      ...(features && { features }),
      ...(limits && { limits }),
      sanctions: sanctionsSettings,
      crmIntegrationName,
      sarJurisdictions,
    });
  };
  const showModal = () => {
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    setFeatures(settings.features?.sort());
    setLimits(settings.limits || {});
    setTenantIdToDelete(undefined);
    setInstantDelete(false);
    setContainerCollapssed({
      deletionContainer: true,
      markedForDeletionContainer: true,
      failedToDeleteContainer: true,
    });
    setDownloadFeatureState(false);
    setSanctionsSettings(settings.sanctions);
    setCrmIntegrationName(settings.crmIntegrationName ?? undefined);
    setSarJurisdictions(settings.sarJurisdictions ?? []);
    setBatchJobName('DEMO_MODE_DATA_LOAD');
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
        destroyOnClose
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
              <ListTenants
                tenants={tenantsDeletedRecently}
                label="Tenants recently deleted in last 30 days"
                containerCollapsed={containerCollapssed.deletionContainer}
                onClick={() => handleContainerCollapse('deletionContainer')}
              />
            ) : (
              <></>
            )}
            {tenantsMarkedForDelete?.length ? (
              <ListTenants
                tenants={tenantsMarkedForDelete}
                label="Tenants marked for delete"
                containerCollapsed={containerCollapssed.markedForDeletionContainer}
                onClick={() => handleContainerCollapse('markedForDeletionContainer')}
              />
            ) : (
              <></>
            )}
            {tenantsFailedToDelete?.length ? (
              <ListTenants
                tenants={tenantsFailedToDelete}
                label="Tenants failed to delete "
                containerCollapsed={containerCollapssed.failedToDeleteContainer}
                onClick={() => handleContainerCollapse('failedToDeleteContainer')}
              />
            ) : (
              <></>
            )}
            <div className={s.divider} />
            <Label
              label="Features"
              description="Enabled features of the tenant"
              testId="features-select"
            >
              <Select<Feature>
                mode="MULTIPLE"
                options={Object.keys(featureDescriptions)
                  .sort()
                  .map((featureKey) => {
                    return {
                      label:
                        featureDescriptions[featureKey].title +
                        (featureDescriptions[featureKey].tag
                          ? ` (${featureDescriptions[featureKey].tag})`
                          : ''),
                      value: featureKey as Feature,
                      title: featureDescriptions[featureKey].description,
                      tag: featureDescriptions[featureKey].tag,
                    };
                  })}
                onChange={(v) => setFeatures(v ?? [])}
                allowClear
                isDisabled={!initialFeatures}
                value={features || initialFeatures}
                onDropdownVisibleChange={(visible) => {
                  if (!visible) {
                    setFeatures((f) => f?.sort() ?? []);
                  }
                }}
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

            {isCrmToBeEnabled && (
              <Label label="Select a CRM">
                <Select
                  options={CRM_INTEGRATION_NAMESS.map((name) => ({
                    label: humanizeConstant(name),
                    value: name,
                  }))}
                  value={crmIntegrationName}
                  onChange={(v) => v && setCrmIntegrationName(v)}
                />
              </Label>
            )}

            {isSARToBeEnabled && (
              <Label label="Select SAR jurisdictions">
                <Select<string>
                  mode="MULTIPLE"
                  options={SARCountries.map((sarCountry) => ({
                    label: humanizeConstant(sarCountry.country),
                    value: sarCountry.countryCode,
                  }))}
                  value={
                    sarJurisdictions.length === 0
                      ? SARCountries?.map((country) => country.countryCode)
                      : sarJurisdictions
                  }
                  onChange={(v) => v && setSarJurisdictions(v)}
                />
              </Label>
            )}

            {isSanctionsToBeEnabled && !hasExternalSanctionsProvider ? (
              <Label label="ComplyAdvantage settings">
                <Label level={2} label="Market type" required={{ value: true, showHint: true }}>
                  <SelectionGroup
                    value={sanctionsSettings?.marketType}
                    onChange={(v) => {
                      setSanctionsSettings({
                        ...sanctionsSettings,
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
                  <TextInput
                    value={sanctionsSettings?.customSearchProfileId}
                    onChange={(value) => {
                      setSanctionsSettings({
                        ...sanctionsSettings,
                        marketType: sanctionsSettings?.marketType ?? 'EMERGING',
                        customSearchProfileId: value?.trim() || '',
                      });
                    }}
                  />
                </Label>
                <Label
                  level={2}
                  label="Custom initial search profile ID"
                  description="If being set, we'll use this search profile for all initial screenings"
                >
                  <TextInput
                    value={sanctionsSettings?.customInitialSearchProfileId}
                    onChange={(value) => {
                      setSanctionsSettings({
                        ...sanctionsSettings,
                        marketType: sanctionsSettings?.marketType ?? 'EMERGING',
                        customInitialSearchProfileId: value?.trim() || '',
                      });
                    }}
                  />
                </Label>
              </Label>
            ) : isDowJonesToBeEnabled ? (
              <Label label="Dow Jones settings">
                <Label level={2} label="Username" required={{ value: true, showHint: true }}>
                  <TextInput
                    value={sanctionsSettings?.dowjonesCreds?.username}
                    onChange={(value) => {
                      setSanctionsSettings({
                        ...sanctionsSettings,
                        dowjonesCreds: {
                          ...sanctionsSettings?.dowjonesCreds,
                          username: value || '',
                        },
                      });
                    }}
                  />
                </Label>
                <Label level={2} label="Password" required={{ value: true, showHint: true }}>
                  <TextInput
                    value={sanctionsSettings?.dowjonesCreds?.password}
                    onChange={(value) => {
                      setSanctionsSettings({
                        ...sanctionsSettings,
                        dowjonesCreds: {
                          ...sanctionsSettings?.dowjonesCreds,
                          password: value || '',
                        },
                      });
                    }}
                  />
                </Label>
              </Label>
            ) : (
              <></>
            )}
            <div className={s.divider} />
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
                message.success(`${humanizeConstant(batchJobName)} started successfully`);
              }}
            >
              {(props) => (
                <Button isDisabled={!batchJobName} type={'PRIMARY'} onClick={props.onClick}>
                  Run
                </Button>
              )}
            </Confirm>

            <div className={s.divider} />
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
              onClick={() =>
                mutateTenantSettings.mutate({
                  apiKeyViewData: [],
                })
              }
            >
              Reset current API key view count
            </Button>

            <div className={s.divider} />
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
                    message.success(`${tenantIdToDelete} deleted successfully`);
                  }}
                >
                  {(props) => (
                    <Button isDisabled={!tenantIdToDelete} type={'DANGER'} onClick={props.onClick}>
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
                    <Button type={'DANGER'} onClick={props.onClick}>
                      {settings.isAccountSuspended ? 'Unsuspend' : 'Suspend'} account
                    </Button>
                  )}
                </Confirm>
                <br />
              </>
            )}
            <Button
              type={'PRIMARY'}
              onClick={async () => {
                try {
                  setDownloadFeatureState(true);
                  message.info('Pulling features config');
                  await handlePullAllTenantsFeatures();
                } catch (e) {
                  message.error(`Failed to download features config ${e}`);
                } finally {
                  setDownloadFeatureState(false);
                }
              }}
              isLoading={downloadFeatureLoading}
            >
              Download features config
            </Button>
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

const ListTenants = ({
  tenants,
  label,
  containerCollapsed,
  onClick,
}: {
  tenants: TenantData[];
  label: string;
  containerCollapsed: boolean;
  onClick: () => void;
}) => {
  return (
    <Label
      label={`${label} (${tenants.length})`}
      iconRight={
        <ExpandIcon
          isExpanded={!containerCollapsed}
          color="BLACK"
          onClick={onClick}
          cursor="pointer"
        />
      }
    >
      <ExpandContainer isCollapsed={containerCollapsed}>
        <div className={s.horizontalSpaceWrap}>
          {tenants.map((tenant, index) => (
            <Tag color={'warning'} key={index}>
              {tenant.tenantName ? tenant.tenantName : tenant.tenantId} ({tenant.tenantId})
            </Tag>
          ))}
        </div>
      </ExpandContainer>
    </Label>
  );
};
