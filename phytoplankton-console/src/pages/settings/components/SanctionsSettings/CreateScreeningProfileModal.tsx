import { useEffect, useState, useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { humanizeAuto, normalizeCase } from '@flagright/lib/utils/humanize';
import s from './styles.module.less';
import { relevanceOptionsMap } from './contants';
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
// import { useHasPermissions } from '@/utils/user-utils';
import { SCREENING_PROFILES, SANCTIONS_SOURCES } from '@/utils/queries/keys';
import Checkbox from '@/components/library/Checkbox';
import Tabs from '@/components/library/Tabs';
import { SANCTIONS_SOURCE_RELEVANCES } from '@/apis/models-custom/SanctionsSourceRelevance';
import { SANCTIONS_SOURCE_TYPES } from '@/apis/models-custom/SanctionsSourceType';
import Select from '@/components/library/Select';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { useQuery } from '@/utils/queries/hooks';
import { PEP_SOURCE_RELEVANCES } from '@/apis/models-custom/PEPSourceRelevance';
import { ADVERSE_MEDIA_SOURCE_RELEVANCES } from '@/apis/models-custom/AdverseMediaSourceRelevance';
import { REL_SOURCE_RELEVANCES } from '@/apis/models-custom/RELSourceRelevance';
import { isSuccess } from '@/utils/asyncResource';

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
  },
};

export default function CreateScreeningProfileModal({ isOpen, onClose, initialValues }: Props) {
  const [alwaysShowErrors, setAlwaysShowErrors] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(isOpen || false);
  const api = useApi();
  const queryClient = useQueryClient();
  const formRef = useRef<any>(null);

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
        };
      }
    }

    return defaultConfig;
  });

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
        }
      } else if (response?.items.length) {
        const sourceIds = response.items.map((source) => source.id).filter(Boolean) as string[];
        updateSourceConfiguration(type, { selectedSources: sourceIds });
      }
    };

    loadSources('SANCTIONS');
    loadSources('PEP');
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
    onError: () => {
      const action = initialValues ? 'update' : 'create';
      message.error(`Failed to ${action} screening profile`);
    },
  });

  const handleSubmit = (values: ScreeningProfileRequest) => {
    setAlwaysShowErrors(true);
    const payload = buildPayload(values);
    mutation.mutate(payload);
  };

  const handleModalSubmit = () => {
    setAlwaysShowErrors(true);
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
          // requiredPermissions={['screening:screening-profiles:write']}
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
          isDisabled: false,
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
          <Tabs
            items={SANCTIONS_SOURCE_TYPES.map((type) => ({
              title: humanizeAuto(type),
              key: type,
              children: (
                <SanctionsSourceTypeTab
                  type={type}
                  config={sourceConfigurations[type]}
                  onChange={(update) => updateSourceConfiguration(type, update)}
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
  const options = {
    SANCTIONS: SANCTIONS_SOURCE_RELEVANCES,
    PEP: PEP_SOURCE_RELEVANCES,
    ADVERSE_MEDIA: ADVERSE_MEDIA_SOURCE_RELEVANCES,
    REGULATORY_ENFORCEMENT_LIST: REL_SOURCE_RELEVANCES,
  };

  const { data: sourcesData } = useQuery(SANCTIONS_SOURCES(type), () =>
    api.getSanctionsSources({
      filterSourceType: type,
    }),
  );

  const handleSourceToggle = (sourceId: string, isSelected: boolean) => {
    if (isSelected) {
      onChange({
        selectedSources: [...(config.selectedSources ?? []), sourceId],
      });
    } else {
      onChange({
        selectedSources: (config.selectedSources ?? []).filter((id) => id !== sourceId),
      });
    }
  };

  const handleSelectAll = (isSelected: boolean | undefined) => {
    if (!isSelected) {
      onChange({ selectedSources: [] });
      return;
    }

    if (isSuccess(sourcesData)) {
      const sources = sourcesData.value.items || [];
      const sourceIds = sources.map((source) => source.id).filter(Boolean) as string[];

      onChange({ selectedSources: sourceIds });
    }
  };

  const areAllSourcesSelected = (): boolean => {
    if (!isSuccess(sourcesData)) {
      return false;
    }

    const sources = sourcesData.value.items || [];
    if (sources.length === 0) {
      return false;
    }

    const validSourceIds = sources.map((source) => source.id).filter(Boolean) as string[];

    return validSourceIds.length > 0 && config.selectedSources?.length === validSourceIds.length;
  };

  return (
    <div className={s.sourceTabContainer}>
      <label className={s.label}>Relevance</label>
      <Select
        className={s.select}
        mode="MULTIPLE"
        value={config.relevance}
        onChange={(value) =>
          onChange({
            relevance: value as (
              | SanctionsSourceRelevance
              | PEPSourceRelevance
              | AdverseMediaSourceRelevance
              | RELSourceRelevance
            )[],
          })
        }
        options={options[type].map((option) => ({
          label: relevanceOptionsMap[option],
          value: option,
        }))}
      />
      {type !== 'REGULATORY_ENFORCEMENT_LIST' && (
        <div className={s.sourceListContainer}>
          <AsyncResourceRenderer resource={sourcesData}>
            {(response) => {
              if (!response.items || response.items.length === 0) {
                return (
                  <div className={s.emptyState}>
                    <p>No sources available for this type.</p>
                  </div>
                );
              }

              return (
                <div className={s.tableContainer}>
                  <div className={s.sourceHeaderFlex}>
                    <Checkbox
                      value={areAllSourcesSelected()}
                      onChange={(checked) => handleSelectAll(!!checked)}
                    />
                    <div>Source</div>
                  </div>
                  <div className={s.sourceList}>
                    {response.items.map((source) => {
                      const isSelected = config.selectedSources?.includes(source.id ?? '');
                      return (
                        <div key={source.id} className={s.source}>
                          <Checkbox
                            value={isSelected}
                            onChange={(checked) => {
                              handleSourceToggle(source.id ?? '', checked ?? false);
                            }}
                          />
                          {normalizeCase(source.sourceName ?? '')}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }}
          </AsyncResourceRenderer>
        </div>
      )}
    </div>
  );
};
