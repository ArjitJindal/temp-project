import { useEffect, useState, useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { humanizeAuto, humanizeCountryName } from '@flagright/lib/utils/humanize';
import { SearchOutlined } from '@ant-design/icons';
import { useDebounce } from 'ahooks';
import { relevanceOptionsMap } from '@flagright/lib/utils';
import s from './styles.module.less';
import Modal from '@/components/library/Modal';
import TextInput from '@/components/library/TextInput';
import { useApi } from '@/api';
import { message } from '@/components/library/Message';
import Form from '@/components/library/Form';
import { notEmpty } from '@/components/library/Form/utils/validation/basicValidators';
import InputField from '@/components/library/Form/InputField';
import {
  AdverseMediaSourceRelevance,
  PEPSourceRelevance,
  RELSourceRelevance,
  SanctionsSourceRelevance,
  SanctionsSourceType,
  ScreeningProfileRequest,
  ScreeningProfileResponse,
} from '@/apis';
import Button from '@/components/library/Button';
// import { useHasResources } from '@/utils/user-utils';
import { SCREENING_PROFILES, SANCTIONS_SOURCES } from '@/utils/queries/keys';
import Checkbox from '@/components/library/Checkbox';
import Tabs from '@/components/library/Tabs';
import { SANCTIONS_SOURCE_RELEVANCES } from '@/apis/models-custom/SanctionsSourceRelevance';
import { SANCTIONS_SOURCE_TYPES } from '@/apis/models-custom/SanctionsSourceType';
import Select from '@/components/library/Select';
import { useQuery } from '@/utils/queries/hooks';
import { PEP_SOURCE_RELEVANCES } from '@/apis/models-custom/PEPSourceRelevance';
import { ADVERSE_MEDIA_SOURCE_RELEVANCES } from '@/apis/models-custom/AdverseMediaSourceRelevance';
import { REL_SOURCE_RELEVANCES } from '@/apis/models-custom/RELSourceRelevance';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { getErrorMessage } from '@/utils/lang';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

const DEFAULT_INITIAL_VALUES: ScreeningProfileRequest = {
  screeningProfileName: '',
  screeningProfileDescription: '',
  isDefault: false,
  screeningProfileStatus: 'ENABLED',
};

interface Props {
  isOpen?: boolean;
  onClose?: () => void;
  initialValues?: ScreeningProfileResponse;
}

type SourceConfiguration = {
  selectedSources?: string[];
  relevance: (
    | SanctionsSourceRelevance
    | PEPSourceRelevance
    | AdverseMediaSourceRelevance
    | RELSourceRelevance
  )[];
};

interface SearchFormValues {
  query: string;
}

const defaultConfig = {
  SANCTIONS: {
    selectedSources: [] as string[],
    relevance: SANCTIONS_SOURCE_RELEVANCES,
  },
  PEP: {
    selectedSources: [] as string[],
    relevance: PEP_SOURCE_RELEVANCES,
  },
  ADVERSE_MEDIA: {
    relevance: ADVERSE_MEDIA_SOURCE_RELEVANCES,
  },
  REGULATORY_ENFORCEMENT_LIST: {
    relevance: REL_SOURCE_RELEVANCES,
    selectedSources: [] as string[],
  },
};

const columnHelper = new ColumnHelper<any>();

const columns = columnHelper.list([
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
    defaultWidth: 100,
    enableResizing: false,
    type: {
      render: (value) => <div>{value}</div>,
    },
  }),
]);

export default function CreateScreeningProfileModal({ isOpen, onClose, initialValues }: Props) {
  const [alwaysShowErrors, setAlwaysShowErrors] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(isOpen || false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const api = useApi();
  const queryClient = useQueryClient();
  const formRef = useRef<any>(null);
  const settings = useSettings();
  const [sourceConfigurations, setSourceConfigurations] = useState<
    Record<string, SourceConfiguration>
  >(() => {
    if (initialValues) {
      if (initialValues.sanctions) {
        defaultConfig.SANCTIONS = {
          selectedSources: initialValues.sanctions.sourceIds || [],
          relevance: initialValues.sanctions.relevance || [],
        };
      }

      if (initialValues.pep) {
        defaultConfig.PEP = {
          selectedSources: initialValues.pep.sourceIds || [],
          relevance: initialValues.pep.relevance || [],
        };
      }

      if (initialValues.adverseMedia) {
        defaultConfig.ADVERSE_MEDIA = {
          relevance: initialValues.adverseMedia.relevance || [],
        };
      }

      if (initialValues.rel) {
        defaultConfig.REGULATORY_ENFORCEMENT_LIST = {
          relevance: initialValues.rel.relevance || [],
          selectedSources: initialValues.rel.sourceIds || [],
        };
      }
    }

    return defaultConfig;
  });

  const hasSelectedSources = useCallback(() => {
    const hasAtLeastOneSource = Object.entries(sourceConfigurations).some(([type, config]) => {
      if (type === 'ADVERSE_MEDIA') {
        return false;
      }
      return (config.selectedSources?.length ?? 0) > 0;
    });

    const hasAtLeastOneRelevance = Object.values(sourceConfigurations).some(
      (config) => config.relevance?.length > 0,
    );

    return hasAtLeastOneSource && hasAtLeastOneRelevance;
  }, [sourceConfigurations]);

  const validateSourcesAndRelevance = useCallback(() => {
    const errors: Record<string, string> = {};

    // Get visible tabs based on provider screening types filter
    const visibleTabs = SANCTIONS_SOURCE_TYPES.filter((type) => {
      const acurisProvider = settings.sanctions?.providerScreeningTypes?.find(
        (p) => p.provider === 'acuris',
      );
      return !acurisProvider || acurisProvider.screeningTypes?.includes(type);
    });

    // Only validate visible tabs
    visibleTabs.forEach((type) => {
      const config = sourceConfigurations[type];
      if (type === 'ADVERSE_MEDIA') {
        return;
      }

      if (
        config.relevance?.length > 0 &&
        (!config.selectedSources || config.selectedSources.length === 0)
      ) {
        errors[type] = `${humanizeAuto(
          type,
        )} has relevance selected but no sources. Please select at least one source.`;
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [sourceConfigurations, settings.sanctions?.providerScreeningTypes]);

  const updateSourceConfiguration = useCallback(
    (type: SanctionsSourceType, update: Partial<SourceConfiguration>) => {
      setSourceConfigurations((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          ...update,
        },
      }));
    },
    [],
  );

  useEffect(() => {
    if (!isModalOpen) {
      return;
    }

    const loadSources = async (type: SanctionsSourceType) => {
      const response = await api.getSanctionsSources({ filterSourceType: type });

      if (initialValues) {
        if (type === 'SANCTIONS' && initialValues.sanctions?.sourceIds) {
          updateSourceConfiguration(type, {
            selectedSources: initialValues.sanctions.sourceIds,
          });
        } else if (type === 'PEP' && initialValues.pep?.sourceIds) {
          updateSourceConfiguration(type, {
            selectedSources: initialValues.pep.sourceIds,
          });
        } else if (type === 'REGULATORY_ENFORCEMENT_LIST' && initialValues.rel?.sourceIds) {
          updateSourceConfiguration(type, {
            selectedSources: initialValues.rel.sourceIds,
          });
        }
      } else if (response?.items.length) {
        const sourceIds = response.items.map((source) => source.id).filter(Boolean) as string[];
        updateSourceConfiguration(type, { selectedSources: sourceIds });
      }
    };

    loadSources('SANCTIONS');
    loadSources('PEP');
    loadSources('REGULATORY_ENFORCEMENT_LIST');
  }, [isModalOpen, api, updateSourceConfiguration, initialValues]);

  const getInitialValues = (): ScreeningProfileRequest => {
    if (!initialValues) {
      return DEFAULT_INITIAL_VALUES;
    }
    return {
      screeningProfileName: initialValues.screeningProfileName || '',
      screeningProfileDescription: initialValues.screeningProfileDescription || '',
      isDefault: initialValues.isDefault || false,
      screeningProfileStatus: initialValues.screeningProfileStatus || 'ENABLED',
    };
  };

  const buildPayload = (
    values: ScreeningProfileRequest,
  ): ScreeningProfileRequest & Record<string, any> => {
    const sourceConfig: Record<string, any> = {};

    if (sourceConfigurations.SANCTIONS) {
      sourceConfig.sanctionsSources = sourceConfigurations.SANCTIONS.selectedSources;
      sourceConfig.sanctionsRelevance = sourceConfigurations.SANCTIONS.relevance;
    }

    if (sourceConfigurations.PEP) {
      sourceConfig.pepSources = sourceConfigurations.PEP.selectedSources;
      sourceConfig.pepRelevance = sourceConfigurations.PEP.relevance;
    }

    if (sourceConfigurations.ADVERSE_MEDIA) {
      sourceConfig.adverseMediaRelevance = sourceConfigurations.ADVERSE_MEDIA.relevance;
    }

    if (sourceConfigurations.REGULATORY_ENFORCEMENT_LIST) {
      sourceConfig.regulatoryEnforcementListRelevance =
        sourceConfigurations.REGULATORY_ENFORCEMENT_LIST.relevance;
      sourceConfig.regulatoryEnforcementListSources =
        sourceConfigurations.REGULATORY_ENFORCEMENT_LIST.selectedSources;
    }

    return {
      ...values,
      ...sourceConfig,
    };
  };

  const mutation = useMutation({
    mutationFn: async (values: ScreeningProfileRequest & Record<string, any>) => {
      const requestPayload: ScreeningProfileRequest = {
        screeningProfileName: values.screeningProfileName,
        screeningProfileDescription: values.screeningProfileDescription,
        isDefault: values.isDefault,
        screeningProfileStatus: values.screeningProfileStatus,
        sanctions: {
          sourceIds: values.sanctionsSources || [],
          relevance: values.sanctionsRelevance,
        },
        pep: {
          sourceIds: values.pepSources || [],
          relevance: values.pepRelevance,
        },
        adverseMedia: {
          relevance: values.adverseMediaRelevance,
        },
        rel: {
          sourceIds: values.regulatoryEnforcementListSources || [],
          relevance: values.regulatoryEnforcementListRelevance,
        },
      };

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
      setIsModalOpen(false);
      onClose?.();
    },
    onError: (error) => {
      const action = initialValues ? 'update' : 'create';
      message.fatal(getErrorMessage(error) || `Failed to ${action} screening profile`);
    },
  });

  const handleSubmit = (values: ScreeningProfileRequest) => {
    setAlwaysShowErrors(true);

    if (!validateSourcesAndRelevance()) {
      return;
    }

    const payload = buildPayload(values);
    mutation.mutate(payload);
  };

  const handleModalSubmit = () => {
    setAlwaysShowErrors(true);

    if (!validateSourcesAndRelevance()) {
      return;
    }

    if (formRef.current) {
      formRef.current.submit();
    }
  };

  return (
    <>
      {!initialValues && (
        <Button
          type="PRIMARY"
          key="create-screening-profile"
          requiredResources={['write:::settings/screening/*']}
          onClick={() => setIsModalOpen(true)}
        >
          Create
        </Button>
      )}
      <Modal
        width="XL"
        destroyOnClose
        title={initialValues ? 'Edit screening profile' : 'Screening profile'}
        isOpen={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          onClose?.();
        }}
        okText={initialValues ? 'Update' : 'Create'}
        cancelText="Cancel"
        onOk={handleModalSubmit}
        okProps={{
          isLoading: mutation.isLoading,
          isDisabled: !hasSelectedSources(),
        }}
      >
        <div className={s.root}>
          <Form<ScreeningProfileRequest>
            ref={formRef}
            initialValues={getInitialValues()}
            onSubmit={(values, state) => {
              if (state.isValid) {
                handleSubmit(values);
              }
            }}
            alwaysShowErrors={alwaysShowErrors}
            fieldValidators={{
              screeningProfileName: notEmpty,
            }}
          >
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
              {(inputProps) => (
                <TextInput {...inputProps} placeholder="Enter profile description" />
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

          <Tabs
            items={SANCTIONS_SOURCE_TYPES.filter((type) => {
              const acurisProvider = settings.sanctions?.providerScreeningTypes?.find(
                (p) => p.provider === 'acuris',
              );
              return !acurisProvider || acurisProvider.screeningTypes?.includes(type);
            }).map((type) => ({
              title: humanizeAuto(type),
              key: type,
              children: (
                <SanctionsSourceTypeTab
                  type={type}
                  config={sourceConfigurations[type]}
                  onChange={(update) => {
                    updateSourceConfiguration(type, update);
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
            }))}
            orientation="VERTICAL"
          />
        </div>
      </Modal>
    </>
  );
}

const SanctionsSourceTypeTab = ({
  type,
  config,
  onChange,
}: {
  type: SanctionsSourceType;
  config: SourceConfiguration;
  onChange: (update: Partial<SourceConfiguration>) => void;
}) => {
  const api = useApi();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, { wait: 200 });

  const options = {
    SANCTIONS: SANCTIONS_SOURCE_RELEVANCES,
    PEP: PEP_SOURCE_RELEVANCES,
    ADVERSE_MEDIA: ADVERSE_MEDIA_SOURCE_RELEVANCES,
    REGULATORY_ENFORCEMENT_LIST: REL_SOURCE_RELEVANCES,
  };

  const queryResults = useQuery(SANCTIONS_SOURCES(type, debouncedSearch), () =>
    api.getSanctionsSources({
      filterSourceType: type,
      searchTerm: debouncedSearch,
    }),
  );

  const handleRelevanceChange = (
    value:
      | (
          | SanctionsSourceRelevance
          | PEPSourceRelevance
          | AdverseMediaSourceRelevance
          | RELSourceRelevance
        )[]
      | undefined,
  ) => {
    if (!value) {
      return;
    }

    const wasEmpty = !config.relevance?.length;
    const isNowEmpty = value.length === 0;

    if (isNowEmpty) {
      onChange({
        relevance: value,
        selectedSources: [],
      });
    } else if (wasEmpty && value.length > 0) {
      let sourceIds: string[] = [];

      if (
        queryResults.data &&
        queryResults.data.kind === 'SUCCESS' &&
        queryResults.data.value?.items
      ) {
        sourceIds = queryResults.data.value.items
          .map((source) => source.id)
          .filter(Boolean) as string[];
      }

      onChange({
        relevance: value,
        selectedSources: sourceIds,
      });
    } else if (type === 'PEP' && !value.includes('PEP')) {
      onChange({
        relevance: value,
        selectedSources: [],
      });
    } else {
      onChange({
        relevance: value,
      });
    }
  };

  const showSourcesTable =
    type !== 'ADVERSE_MEDIA' &&
    (type !== 'PEP' || config.relevance?.includes('PEP')) &&
    config.relevance?.length > 0;

  return (
    <div className={s.sourceTabContainer}>
      <label className={s.label}>Relevance</label>
      <Select
        className={s.select}
        mode="MULTIPLE"
        value={config.relevance}
        onChange={handleRelevanceChange}
        options={options[type].map((option) => ({
          label: relevanceOptionsMap[option],
          value: option,
        }))}
      />

      {showSourcesTable && (
        <Form initialValues={{ query: searchQuery }}>
          <InputField<SearchFormValues, 'query'> name="query" label="" hideLabel>
            {(inputProps) => (
              <TextInput
                {...inputProps}
                placeholder="Search by country or source name"
                value={searchQuery}
                allowClear
                onChange={(value) => setSearchQuery(value || '')}
                icon={<SearchOutlined />}
              />
            )}
          </InputField>
        </Form>
      )}

      <div className={s.sourceListContainer}>
        {!showSourcesTable ? (
          <div className={s.emptyState}>
            <p>No sources available for this type.</p>
          </div>
        ) : (
          <QueryResultsTable
            rowKey="id"
            queryResults={queryResults}
            columns={columns}
            toolsOptions={false}
            selection={true}
            pagination={false}
            selectedIds={config.selectedSources}
            retainSelectedIds
            onSelect={(selectedIds) => {
              onChange({ selectedSources: selectedIds });
            }}
          />
        )}
      </div>
    </div>
  );
};
