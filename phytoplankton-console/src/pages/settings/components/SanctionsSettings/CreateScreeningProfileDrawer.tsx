import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { humanizeAuto, humanizeCountryName } from '@flagright/lib/utils/humanize';
import { SearchOutlined } from '@ant-design/icons';
import { useDebounce } from 'ahooks';
import { relevanceOptionsMap } from '@flagright/lib/utils';
import s from './styles.module.less';
import { getProviderScreeningInfo, getProvidersOptions } from './utils';
import TextInput from '@/components/library/TextInput';
import { useApi } from '@/api';
import { message } from '@/components/library/Message';
import Form from '@/components/library/Form';
import { notEmpty } from '@/components/library/Form/utils/validation/basicValidators';
import InputField from '@/components/library/Form/InputField';
import {
  AdverseMediaSourceRelevance,
  DowJonesAdverseMediaSourceRelevance,
  GenericSanctionsSearchType,
  PEPSourceRelevance,
  RELSourceRelevance,
  SanctionsDataProviderName,
  SanctionsSourceRelevance,
  ScreeningProfileRequest,
  ScreeningProfileResponse,
  TenantSettings,
} from '@/apis';
import Button from '@/components/library/Button';
import { SCREENING_PROFILES, SANCTIONS_SOURCES } from '@/utils/queries/keys';
import Checkbox from '@/components/library/Checkbox';
import Tabs, { TabItem } from '@/components/library/Tabs';
import { SANCTIONS_SOURCE_RELEVANCES } from '@/apis/models-custom/SanctionsSourceRelevance';
import Select from '@/components/library/Select';
import { useQuery } from '@/utils/queries/hooks';
import { PEP_SOURCE_RELEVANCES } from '@/apis/models-custom/PEPSourceRelevance';
import { ADVERSE_MEDIA_SOURCE_RELEVANCES } from '@/apis/models-custom/AdverseMediaSourceRelevance';
import { REL_SOURCE_RELEVANCES } from '@/apis/models-custom/RELSourceRelevance';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { getErrorMessage } from '@/utils/lang';
import { useFeatureEnabled, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { DOW_JONES_ADVERSE_MEDIA_SOURCE_RELEVANCES } from '@/apis/models-custom/DowJonesAdverseMediaSourceRelevance';
import { DOW_JONES_PEP_SOURCE_RELEVANCES } from '@/apis/models-custom/DowJonesPEPSourceRelevance';
import { useFormState } from '@/components/library/Form/utils/hooks';
import Drawer from '@/components/library/Drawer';
import { map } from '@/utils/asyncResource';
import Table from '@/components/library/Table';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { GENERIC_SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/GenericSanctionsSearchType';
import { OPEN_SANCTIONS_PEP_SOURCE_RELEVANCES } from '@/apis/models-custom/OpenSanctionsPEPSourceRelevance';
import { OPEN_SANCTIONS_CRIME_SOURCE_RELEVANCES } from '@/apis/models-custom/OpenSanctionsCrimeSourceRelevance';

const ScreeningTypeMap: {
  [key in GenericSanctionsSearchType]: string;
} = {
  SANCTIONS: 'sanctions',
  PEP: 'pep',
  ADVERSE_MEDIA: 'adverseMedia',
  REGULATORY_ENFORCEMENT_LIST: 'rel',
  CRIME: 'crime',
};

const screeningProfileRequestFromResponse = (
  response?: ScreeningProfileResponse,
): ScreeningProfileRequest => {
  return {
    screeningProfileName: response?.screeningProfileName ?? '',
    screeningProfileDescription: response?.screeningProfileDescription ?? '',
    isDefault: response?.isDefault ?? false,
    screeningProfileStatus: response?.screeningProfileStatus ?? 'ENABLED',
    sanctions: {
      sourceIds: response?.sanctions?.sourceIds ?? [],
      relevance: response?.sanctions?.relevance ?? [],
    },
    pep: {
      sourceIds: response?.pep?.sourceIds ?? [],
      relevance: response?.pep?.relevance ?? [],
    },
    adverseMedia: {
      relevance: response?.adverseMedia?.relevance ?? [],
    },
    rel: {
      sourceIds: response?.rel?.sourceIds ?? [],
      relevance: response?.rel?.relevance ?? [],
    },
    crime: {
      relevance: response?.crime?.relevance ?? [],
    },
    provider: response?.provider ?? undefined,
    containAllSources: response?.containAllSources ?? true,
  };
};

interface Props {
  isOpen?: boolean;
  onClose?: () => void;
  initialValues?: ScreeningProfileResponse;
}

type SourceConfiguration = {
  sourceIds?: string[];
  relevance: (
    | SanctionsSourceRelevance
    | PEPSourceRelevance
    | AdverseMediaSourceRelevance
    | DowJonesAdverseMediaSourceRelevance
    | RELSourceRelevance
  )[];
};

const getDefaultConfig = (provider?: SanctionsDataProviderName): ScreeningProfileRequest => {
  const isProviderDowJones = provider === 'dowjones';
  const isProviderOpenSanctions = provider === 'open-sanctions';
  const defaultConfig: ScreeningProfileRequest = {
    screeningProfileName: '',
    provider: provider,
  };
  if (isProviderDowJones) {
    return {
      ...defaultConfig,
      sanctions: {
        sourceIds: [] as string[],
        relevance: SANCTIONS_SOURCE_RELEVANCES,
      },
      pep: {
        sourceIds: [] as string[],
        relevance: DOW_JONES_PEP_SOURCE_RELEVANCES,
      },
      adverseMedia: {
        relevance: DOW_JONES_ADVERSE_MEDIA_SOURCE_RELEVANCES,
      },
      rel: {
        relevance: [],
        sourceIds: [] as string[],
      },
    };
  }
  if (isProviderOpenSanctions) {
    return {
      ...defaultConfig,
      sanctions: {
        sourceIds: [] as string[],
        relevance: [],
      },
      pep: {
        sourceIds: [] as string[],
        relevance: OPEN_SANCTIONS_PEP_SOURCE_RELEVANCES,
      },
      adverseMedia: {
        relevance: [],
      },
      rel: {
        relevance: [],
        sourceIds: [] as string[],
      },
      crime: {
        relevance: OPEN_SANCTIONS_CRIME_SOURCE_RELEVANCES,
      },
    };
  }
  return {
    ...defaultConfig,
    sanctions: {
      sourceIds: [] as string[],
      relevance: SANCTIONS_SOURCE_RELEVANCES,
    },
    pep: {
      sourceIds: [] as string[],
      relevance: PEP_SOURCE_RELEVANCES,
    },
    adverseMedia: {
      relevance: ADVERSE_MEDIA_SOURCE_RELEVANCES,
    },
    rel: {
      relevance: REL_SOURCE_RELEVANCES,
      sourceIds: [] as string[],
    },
  };
};

const columnHelper = new ColumnHelper<any>();

const getColumns = (isDowJonesEnabled: boolean) =>
  columnHelper.list(
    [
      !isDowJonesEnabled &&
        columnHelper.simple<'sourceCountry'>({
          key: 'sourceCountry',
          title: 'Country',
          defaultWidth: 200,
          enableResizing: false,
          type: {
            render: (value) => <div>{humanizeCountryName(value ?? '')}</div>,
          },
        }),
      columnHelper.simple<'displayName'>({
        key: 'displayName',
        title: 'Source',
        defaultWidth: 700,
        enableResizing: false,
        type: {
          render: (value) => {
            return <div>{value ?? ''}</div>;
          },
        },
      }),
      columnHelper.simple<'entityCount'>({
        key: 'entityCount',
        title: 'Number of entities',
        defaultWidth: 75,
        enableResizing: false,
        type: {
          render: (value) => <div>{value}</div>,
        },
      }),
    ].filter(Boolean),
  );

interface ProviderScreeningProfile {
  provider?: SanctionsDataProviderName;
  screeningProfileRequest: ScreeningProfileRequest;
}

export default function CreateScreeningProfileDrawer({ isOpen, onClose, initialValues }: Props) {
  const [alwaysShowErrors, setAlwaysShowErrors] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(isOpen || false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [selectedProvider, setSelectedProvider] = useState<SanctionsDataProviderName | undefined>(
    undefined,
  );
  const settings = useSettings();
  const { screeningTypes: providerScreeningTypes } = getProviderScreeningInfo(
    settings.sanctions,
    selectedProvider,
  );
  const [screeningProfile, setScreeningProfile] = useState<ProviderScreeningProfile[]>([
    {
      provider: initialValues?.provider,
      screeningProfileRequest:
        screeningProfileRequestFromResponse(initialValues) ?? getDefaultConfig(selectedProvider),
    },
  ]);
  const api = useApi();
  const queryClient = useQueryClient();
  const formRef = useRef<any>(null);

  const [allSourcesCount, _setAllSourcesCount] = useState<number | undefined>(undefined);

  const mutation = useMutation({
    mutationFn: async (values: ScreeningProfileRequest) => {
      const requestPayload: ScreeningProfileRequest = {
        screeningProfileName: values.screeningProfileName,
        screeningProfileDescription: values.screeningProfileDescription,
        isDefault: values.isDefault,
        screeningProfileStatus: values.screeningProfileStatus,
        sanctions: {
          sourceIds: values.sanctions?.sourceIds || [],
          relevance: values.sanctions?.relevance || [],
        },
        pep: {
          sourceIds: values.pep?.sourceIds || [],
          relevance: values.pep?.relevance || [],
        },
        adverseMedia: {
          relevance: values.adverseMedia?.relevance || [],
        },
        rel: {
          sourceIds: values.rel?.sourceIds || [],
          relevance: values.rel?.relevance || [],
        },
        crime: {
          relevance: values.crime?.relevance || [],
        },
        provider: values.provider,
      };

      const selectedSourcesCount =
        (requestPayload.sanctions?.sourceIds?.length ?? 0) +
        (requestPayload.pep?.sourceIds?.length ?? 0) +
        (requestPayload.rel?.sourceIds?.length ?? 0);
      requestPayload.containAllSources =
        selectedSourcesCount === allSourcesCount &&
        requestPayload.adverseMedia?.relevance?.length === ADVERSE_MEDIA_SOURCE_RELEVANCES.length &&
        requestPayload.sanctions?.relevance?.length === SANCTIONS_SOURCE_RELEVANCES.length &&
        requestPayload.pep?.relevance?.length === PEP_SOURCE_RELEVANCES.length &&
        requestPayload.rel?.relevance?.length === REL_SOURCE_RELEVANCES.length;

      const action = initialValues ? 'Updating' : 'Creating';
      message.loading(`${action} screening profile...`);
      if (initialValues?.screeningProfileId) {
        return api.updateScreeningProfile({
          screeningProfileId: initialValues.screeningProfileId,
          ScreeningProfileRequest: requestPayload,
        });
      } else {
        return api.postScreeningProfiles({
          ScreeningProfileRequest: requestPayload,
        });
      }
    },
    onSuccess: async () => {
      const action = initialValues ? 'updated' : 'created';
      message.success(`Screening profile ${action} successfully`);
      await queryClient.invalidateQueries(SCREENING_PROFILES());
      await queryClient.invalidateQueries(
        SCREENING_PROFILES({ filterScreeningProfileStatus: 'ENABLED' }),
      );
      setIsDrawerOpen(false);
      onClose?.();
    },
    onError: (error) => {
      const action = initialValues ? 'update' : 'create';
      message.fatal(getErrorMessage(error) || `Failed to ${action} screening profile`);
    },
  });

  const validateSourcesAndRelevance = useCallback(() => {
    const errors: Record<string, string> = {};

    // Get visible tabs based on provider screening types filter
    const visibleTabs = GENERIC_SANCTIONS_SEARCH_TYPES.filter((type) => {
      return !selectedProvider || providerScreeningTypes?.includes(type);
    });

    // Only validate visible tabs
    visibleTabs.forEach((type) => {
      const config = screeningProfile.find((sp) => sp.provider === selectedProvider)
        ?.screeningProfileRequest?.[ScreeningTypeMap[type]];
      if (selectedProvider === 'open-sanctions') {
        return;
      }
      if (ScreeningTypeMap[type] === 'adverseMedia') {
        return;
      }

      if (config.relevance?.length > 0 && (!config.sourceIds || config.sourceIds.length === 0)) {
        errors[type] = `${humanizeAuto(
          type,
        )} has relevance selected but no sources. Please select at least one source.`;
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [selectedProvider, providerScreeningTypes, screeningProfile]);

  const handleSubmit = (request?: ScreeningProfileRequest) => {
    setAlwaysShowErrors(true);
    const provider = request?.provider;
    const payload = screeningProfile.find(
      (sp) => sp.provider === provider,
    )?.screeningProfileRequest;
    if (!validateSourcesAndRelevance() || !payload || !provider) {
      return;
    }
    mutation.mutate({
      ...request,
      ...payload,
      screeningProfileName: request?.screeningProfileName,
      screeningProfileDescription: request?.screeningProfileDescription,
      isDefault: request?.isDefault,
      provider: request?.provider,
    });
  };

  const handleDrawerSubmit = () => {
    setAlwaysShowErrors(true);
    if (!selectedProvider) {
      message.error('Please select provider');
      return;
    }
    if (!validateSourcesAndRelevance()) {
      return;
    }

    if (formRef.current) {
      formRef.current.submit();
    }
  };
  useEffect(() => {
    if (selectedProvider) {
      const targetScreeingProfile = screeningProfile.find(
        (scp) => scp.provider === selectedProvider,
      );
      if (!targetScreeingProfile) {
        setScreeningProfile((prev) => {
          return [
            ...prev,
            {
              provider: selectedProvider,
              screeningProfileRequest: getDefaultConfig(selectedProvider),
            },
          ];
        });
      }
    }
  }, [screeningProfile, selectedProvider]);
  const updateSourceConfiguration = useCallback(
    (type: string, update: Partial<SourceConfiguration>, provider?: SanctionsDataProviderName) => {
      if (!provider) {
        return;
      }
      setScreeningProfile((prev) => {
        return prev.map((sp) => {
          if (sp.provider === provider) {
            const typeCasted = ScreeningTypeMap[type];
            return {
              ...sp,
              screeningProfileRequest: {
                ...sp.screeningProfileRequest,
                [typeCasted]: {
                  ...sp.screeningProfileRequest[typeCasted],
                  ...update,
                },
              },
            };
          }
          return sp;
        });
      });
    },
    [],
  );
  const tabItems = useMemo(() => {
    return providerScreeningTypes.map((type) => ({
      title: humanizeAuto(type),
      key: type,
      children: (
        <SanctionsSourceTypeTab
          type={type}
          screeningProfile={
            {
              [ScreeningTypeMap[type]]: (screeningProfile?.find(
                (sp) => sp?.provider === selectedProvider,
              )?.screeningProfileRequest ?? getDefaultConfig(selectedProvider))?.[
                ScreeningTypeMap[type]
              ],
            } as ScreeningProfileResponse
          }
          provider={selectedProvider}
          onChange={(update) => {
            updateSourceConfiguration(type, update, selectedProvider);
            if (validationErrors[type]) {
              setValidationErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[type];
                return newErrors;
              });
            }
          }}
        />
      ),
    }));
  }, [
    updateSourceConfiguration,
    validationErrors,
    selectedProvider,
    screeningProfile,
    providerScreeningTypes,
  ]);

  return (
    <>
      {!initialValues && (
        <Button
          type="PRIMARY"
          key="create-screening-profile"
          requiredResources={['write:::settings/screening/*']}
          onClick={() => setIsDrawerOpen(true)}
        >
          Create
        </Button>
      )}
      <Drawer
        isVisible={isDrawerOpen}
        onChangeVisibility={() => {
          setIsDrawerOpen(false);
          onClose?.();
        }}
        title={initialValues ? 'Edit screening profile' : 'Screening profile'}
        drawerMaxWidth="90%"
        footer={
          <div className={s.footer}>
            <Button type="PRIMARY" onClick={handleDrawerSubmit}>
              {initialValues ? 'Update' : 'Create'}
            </Button>
            <Button
              type="TETRIARY"
              onClick={() => {
                setIsDrawerOpen(false);
                onClose?.();
              }}
            >
              Cancel
            </Button>
          </div>
        }
      >
        <div className={s.root}>
          <Form<ScreeningProfileRequest>
            ref={formRef}
            initialValues={screeningProfileRequestFromResponse(initialValues)}
            onSubmit={(values, state) => {
              if (state.isValid) {
                handleSubmit(values);
              }
            }}
            className={s.form}
            alwaysShowErrors={alwaysShowErrors}
            fieldValidators={{
              screeningProfileName: notEmpty,
            }}
          >
            <ScreeningProfileForm
              settings={settings}
              tabItems={tabItems}
              setSelectedProvider={setSelectedProvider}
            />
          </Form>

          {Object.keys(validationErrors).length > 0 && (
            <div className={s.validationErrors}>
              {Object.values(validationErrors).map((error, index) => (
                <div className={s.validationError} key={index}>
                  {error}
                </div>
              ))}
            </div>
          )}
        </div>
      </Drawer>
    </>
  );
}

const ScreeningProfileForm = ({
  settings,
  tabItems,
  setSelectedProvider,
}: {
  settings: TenantSettings;
  tabItems: TabItem[];
  setSelectedProvider: (provider: SanctionsDataProviderName | undefined) => void;
}) => {
  const { values } = useFormState<ScreeningProfileRequest>();
  const providerOptions = getProvidersOptions(settings.features || []);
  useEffect(() => {
    setSelectedProvider(values.provider);
  }, [values.provider, setSelectedProvider]);
  return (
    <div className={s.formContainer}>
      <InputField<ScreeningProfileRequest, 'screeningProfileName'>
        name="screeningProfileName"
        label="Screening profile name"
        labelProps={{
          required: {
            showHint: true,
            value: true,
          },
        }}
      >
        {(inputProps) => <TextInput {...inputProps} placeholder="Enter profile name" />}
      </InputField>

      <InputField<ScreeningProfileRequest, 'screeningProfileDescription'>
        name="screeningProfileDescription"
        label="Screening profile description"
      >
        {(inputProps) => <TextInput {...inputProps} placeholder="Enter profile description" />}
      </InputField>
      <InputField<ScreeningProfileRequest, 'provider'>
        name="provider"
        label="Select provider"
        description="Select data provider to populate screening sources"
        labelProps={{
          required: {
            showHint: true,
            value: true,
          },
        }}
      >
        {(inputProps) => (
          <Select
            {...inputProps}
            mode="SINGLE"
            options={providerOptions}
            allowClear
            value={values.provider}
          />
        )}
      </InputField>
      <InputField<ScreeningProfileRequest, 'isDefault'> name="isDefault" hideLabel label="">
        {(inputProps) => (
          <div className={s.checkboxContainer}>
            <Checkbox {...inputProps} />
            <div>Set this screening profile as default</div>
          </div>
        )}
      </InputField>
      {values.provider ? <Tabs items={tabItems} orientation="VERTICAL" /> : <></>}
    </div>
  );
};

const SanctionsSourceTypeTab = ({
  type,
  onChange,
  screeningProfile,
  provider,
}: {
  type: GenericSanctionsSearchType;
  screeningProfile: ScreeningProfileResponse;
  provider?: SanctionsDataProviderName;
  onChange: (update: Partial<SourceConfiguration>) => void;
}) => {
  const api = useApi();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, { wait: 200 });
  const isDowJonesEnabled = useFeatureEnabled('DOW_JONES');
  const response = useQuery(SANCTIONS_SOURCES(provider, type, debouncedSearch), async () => {
    const response = await api.getSanctionsSources({
      filterSourceType: type,
      searchTerm: debouncedSearch,
      provider: provider,
    });
    return response;
  });
  const showSourcesTable =
    type !== 'ADVERSE_MEDIA' &&
    type !== 'CRIME' &&
    (provider !== 'open-sanctions' || type !== 'PEP');
  return (
    <AsyncResourceRenderer resource={response.data}>
      {(data) => {
        const queryResults = map(response.data, (data) => {
          return {
            items: data.sources,
            total: data.sources.length,
          };
        });

        return (
          <div className={s.sourceTabContainer}>
            {data.relevance && data.relevance.length > 0 ? (
              <>
                <label className={s.label}>Relevance</label>
                <div className={s.select}>
                  <Select
                    mode="MULTIPLE"
                    value={screeningProfile[ScreeningTypeMap[type]]?.relevance}
                    onChange={(val) => {
                      onChange({ relevance: val });
                    }}
                    options={data?.relevance.map((option) => ({
                      label: relevanceOptionsMap[option],
                      value: option,
                    }))}
                  />
                </div>
              </>
            ) : (
              <></>
            )}

            {showSourcesTable && (
              <div className={s.searchContainer}>
                <TextInput
                  placeholder="Search by country or source name"
                  value={searchQuery}
                  allowClear
                  onChange={(value) => setSearchQuery(value || '')}
                  icon={<SearchOutlined />}
                />
              </div>
            )}

            <div className={s.sourceListContainer}>
              {!showSourcesTable ? (
                <div className={s.emptyState}>
                  <p>No sources available for this type.</p>
                </div>
              ) : (
                <Table
                  rowKey="id"
                  data={queryResults}
                  columns={getColumns(isDowJonesEnabled)}
                  toolsOptions={false}
                  selection={true}
                  pagination={false}
                  selectedIds={screeningProfile[ScreeningTypeMap[type]]?.sourceIds}
                  // retainSelectedIds
                  onSelect={(selectedIds) => {
                    onChange({ sourceIds: selectedIds });
                  }}
                />
              )}
            </div>
          </div>
        );
      }}
    </AsyncResourceRenderer>
  );
};
