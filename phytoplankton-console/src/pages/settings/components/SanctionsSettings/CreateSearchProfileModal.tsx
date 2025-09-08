import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { COUNTRIES } from '@flagright/lib/constants';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
import s from './styles.module.less';
import { getSanctionsSearchTypeOptions } from './utils';
import Modal from '@/components/library/Modal';
import TextInput from '@/components/library/TextInput';
import { useApi } from '@/api';
import { message } from '@/components/library/Message';
import Form from '@/components/library/Form';
import { notEmpty } from '@/components/library/Form/utils/validation/basicValidators';
import InputField from '@/components/library/Form/InputField';
import Select from '@/components/library/Select';
import NumberInput from '@/components/library/NumberInput';
import {
  GenericSanctionsSearchType,
  SearchProfileRequest,
  SearchProfileResponse,
  TenantSettings,
} from '@/apis';
import Button from '@/components/library/Button';
import { useHasResources } from '@/utils/user-utils';
import { SEARCH_PROFILES } from '@/utils/queries/keys';
import DeleteIcon from '@/components/ui/icons/Remix/system/delete-bin-7-line.react.svg';
import Checkbox from '@/components/library/Checkbox';
import {
  useHasNoSanctionsProviders,
  useSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import { GENERIC_SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/GenericSanctionsSearchType';

interface FilterRow {
  filter: string;
  value: any;
  isLocked: boolean;
}

const AVAILABLE_FILTERS = (settings?: TenantSettings) => {
  const matchTypesOptions = settings
    ? getSanctionsSearchTypeOptions(
        settings?.features ?? [],
        settings?.sanctions?.providerScreeningTypes,
      ).map((type) => ({ label: humanizeAuto(type), value: type }))
    : GENERIC_SANCTIONS_SEARCH_TYPES.map((type) => ({ label: humanizeAuto(type), value: type }));
  return [
    {
      label: 'Matched type',
      value: 'types',
      type: 'multi',
      options: matchTypesOptions,
    },
    {
      label: 'Fuzziness',
      value: 'fuzziness',
      type: 'number',
      min: 0,
      max: 1,
      step: 0.01,
      defaultValue: 0.5,
    },
  ];
};

const DEFAULT_INITIAL_VALUES: SearchProfileRequest = {
  searchProfileName: '',
  searchProfileDescription: '',
  isDefault: false,
  searchProfileStatus: 'ENABLED',
};

interface Props {
  isOpen?: boolean;
  onClose?: () => void;
  onSave?: (values: SearchProfileRequest) => Promise<void>;
  initialValues?: SearchProfileResponse;
}

export default function CreateSearchProfileModal({
  isOpen,
  onClose,
  onSave,
  initialValues,
}: Props) {
  const [alwaysShowErrors, setAlwaysShowErrors] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(isOpen || false);
  const [selectedFilter, setSelectedFilter] = useState<string>('');
  const [selectedValue, setSelectedValue] = useState<any>(undefined);
  const [filters, setFilters] = useState<FilterRow[]>(() => {
    if (!initialValues) {
      return [];
    }

    const initialFilters: FilterRow[] = [];
    if (initialValues.types?.length) {
      initialFilters.push({ filter: 'types', value: initialValues.types, isLocked: false });
    }
    if (initialValues.fuzziness !== undefined) {
      initialFilters.push({ filter: 'fuzziness', value: initialValues.fuzziness, isLocked: false });
    }
    if (initialValues.nationality?.length) {
      initialFilters.push({
        filter: 'nationality',
        value: initialValues.nationality,
        isLocked: false,
      });
    }
    return initialFilters;
  });
  const isReadOnly = !useHasResources(['write:::screening/search-profiles/*']);
  const api = useApi();
  const queryClient = useQueryClient();
  const isSanctionsEnabledWithDataProvider = !useHasNoSanctionsProviders();
  const settings = useSettings();
  const availableFilters = AVAILABLE_FILTERS(settings);
  if (isSanctionsEnabledWithDataProvider && availableFilters.length === 2) {
    availableFilters.push({
      label: 'Nationality',
      value: 'nationality',
      type: 'multi',
      options: Object.entries(COUNTRIES).map(([code, name]) => ({
        label: name,
        value: code as GenericSanctionsSearchType,
      })),
    });
  }

  const handleAddFilter = () => {
    if (!selectedFilter || selectedValue === undefined) {
      return;
    }
    const existingFilterIndex = filters.findIndex((f) => f.filter === selectedFilter);
    if (existingFilterIndex !== -1) {
      filters.splice(existingFilterIndex, 1);
    }
    setFilters([{ filter: selectedFilter, value: selectedValue, isLocked: false }, ...filters]);
    setSelectedFilter('');
    setSelectedValue(undefined);
  };

  const handleRemoveFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const mutation = useMutation({
    mutationFn: async (values: SearchProfileRequest) => {
      const filterValues = filters.reduce((acc, { filter, value }) => {
        if (filter && value !== undefined && value !== '') {
          acc[filter] = value;
        }
        return acc;
      }, {} as Record<string, any>);

      if (initialValues) {
        await api.updateSearchProfile({
          searchProfileId: initialValues.searchProfileId || '',
          SearchProfileRequest: {
            ...values,
            ...filterValues,
          },
        });
      } else {
        await api.postSearchProfiles({
          SearchProfileRequest: {
            ...values,
            ...filterValues,
          },
        });
      }
    },
    onSuccess: async () => {
      message.success(
        initialValues
          ? 'Search profile updated successfully'
          : 'Search profile created successfully',
      );
      await queryClient.invalidateQueries(SEARCH_PROFILES());
      setIsModalOpen(false);
      setFilters([]);
      onClose?.();
    },
    onError: (error) => {
      message.error(
        initialValues ? 'Failed to update search profile' : 'Failed to create search profile',
      );
      console.error(
        initialValues ? 'Failed to update search profile:' : 'Failed to create search profile:',
        error,
      );
    },
  });

  const getInitialValues = (): SearchProfileRequest => {
    if (!initialValues) {
      return DEFAULT_INITIAL_VALUES;
    }
    return {
      searchProfileName: initialValues.searchProfileName || '',
      searchProfileDescription: initialValues.searchProfileDescription || '',
      isDefault: initialValues.isDefault || false,
      searchProfileStatus: initialValues.searchProfileStatus || 'ENABLED',
    };
  };

  if (isReadOnly) {
    return null;
  }

  const renderFilterValue = (filterType: string, value?: any, onChange?: (value: any) => void) => {
    const filterConfig = availableFilters.find((f) => f.value === filterType);
    const currentValue = value !== undefined ? value : selectedValue;

    const handleChange = (newValue: any) => {
      if (onChange) {
        onChange(newValue);

        const filterIndex = filters.findIndex((f) => f.filter === filterType);
        if (filterIndex !== -1) {
          const updatedFilters = [...filters];
          updatedFilters[filterIndex] = {
            ...updatedFilters[filterIndex],
            value: newValue,
          };
          setFilters(updatedFilters);
        } else {
          setSelectedValue(newValue);
        }
      } else {
        setSelectedValue(newValue);
      }
    };

    switch (filterConfig?.type) {
      case 'multi':
        return (
          <Select
            mode="MULTIPLE"
            allowNewOptions
            placeholder="Select an option"
            options={filterConfig.options || []}
            value={currentValue}
            onChange={handleChange}
          />
        );
      case 'number':
        return (
          <NumberInput
            placeholder="Enter an input"
            value={currentValue}
            onChange={handleChange}
            min={filterConfig.min}
            max={filterConfig.max}
            step={filterConfig.step}
          />
        );
      default:
        return (
          <TextInput
            placeholder="Enter an input"
            className={s.filterTextInput}
            value={currentValue}
            onChange={handleChange}
          />
        );
    }
  };

  return (
    <>
      {!initialValues && (
        <Button
          type="PRIMARY"
          key="create-search-profile"
          requiredResources={['write:::screening/search-profiles/*']}
          onClick={() => setIsModalOpen(true)}
        >
          Create
        </Button>
      )}
      <Modal
        width="L"
        title={initialValues ? 'Edit search profile' : 'Search profile'}
        isOpen={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          setFilters([]);
          onClose?.();
        }}
        okText={initialValues ? 'Update' : 'Create'}
        cancelText="Cancel"
        onOk={() => {
          setAlwaysShowErrors(true);
          const form = document.querySelector('form');
          if (form) {
            form.requestSubmit();
          }
        }}
        okProps={{
          isLoading: mutation.isLoading,
        }}
      >
        <div className={s.root}>
          <Form<SearchProfileRequest>
            initialValues={getInitialValues()}
            onSubmit={(values, state) => {
              if (state.isValid) {
                const filterValues = filters.reduce((acc, { filter, value }) => {
                  if (filter && value !== undefined && value !== '') {
                    acc[filter] = value;
                  }
                  return acc;
                }, {} as Record<string, any>);

                if (onSave) {
                  onSave({ ...values, ...filterValues });
                } else {
                  mutation.mutate({ ...values, ...filterValues });
                }
              }
            }}
            alwaysShowErrors={alwaysShowErrors}
            fieldValidators={{
              searchProfileName: notEmpty,
              searchProfileDescription: notEmpty,
            }}
          >
            <InputField<SearchProfileRequest, 'searchProfileName'>
              name="searchProfileName"
              label="Search profile name"
              labelProps={{
                required: {
                  showHint: true,
                  value: true,
                },
              }}
            >
              {(inputProps) => <TextInput {...inputProps} placeholder="Enter profile name" />}
            </InputField>

            <InputField<SearchProfileRequest, 'searchProfileDescription'>
              name="searchProfileDescription"
              label="Search profile description"
            >
              {(inputProps) => (
                <TextInput {...inputProps} placeholder="Enter profile description" />
              )}
            </InputField>
            <InputField<SearchProfileRequest, 'isDefault'> name="isDefault" hideLabel label="">
              {(inputProps) => (
                <div className={s.checkboxContainer}>
                  <Checkbox {...inputProps} />
                  <div>Set this search profile as default</div>
                </div>
              )}
            </InputField>

            <div className={s.filtersSection}>
              <div className={s.filtersSectionHeader}>
                <div className={s.filtersSectionTitle}>Set default filters</div>
              </div>
              {filters.length < availableFilters.length && (
                <div className={s.filterInputRow}>
                  <div className={s.filterSelect}>
                    <label className={s.filterSelectLabel}>Set default filter</label>
                    <Select
                      value={selectedFilter}
                      onChange={(value: string | undefined) => {
                        if (value) {
                          setSelectedFilter(value);
                          setSelectedValue(undefined);
                        }
                      }}
                      placeholder="Set default filter"
                      options={availableFilters
                        .filter((filter) => !filters.some((f) => f.filter === filter.value))
                        .map((filter) => ({
                          label: filter.label,
                          value: filter.value,
                        }))}
                    />
                  </div>
                  <div className={s.filterValue}>
                    <label className={s.filterValueLabel}>Set default filter value</label>
                    {renderFilterValue(selectedFilter)}
                  </div>
                  <Button
                    className={s.addFilterButton}
                    type="SECONDARY"
                    onClick={handleAddFilter}
                    testName="add-filter-button"
                    isDisabled={!selectedFilter || selectedValue === undefined}
                  >
                    Add
                  </Button>
                </div>
              )}
              <div className={s.filtersList}>
                {filters.map((filterRow, index) => {
                  const filterConfig = availableFilters.find((f) => f.value === filterRow.filter);

                  const handleFilterValueChange = (newValue: any) => {
                    const updatedFilters = [...filters];
                    updatedFilters[index] = {
                      ...updatedFilters[index],
                      value: newValue,
                    };
                    setFilters(updatedFilters);
                  };

                  return (
                    <div key={index} className={s.filterInputRow}>
                      <div className={s.filterSelect}>
                        <label className={s.filterSelectLabel}>Set default filter</label>
                        <Select
                          value={filterRow.filter}
                          isDisabled
                          options={[filterConfig].map((filter) => ({
                            label: filter?.label,
                            value: filter?.value,
                          }))}
                        />
                      </div>
                      <div className={s.filterValue}>
                        <label className={s.filterValueLabel}>Set default filter value</label>
                        {renderFilterValue(
                          filterRow.filter,
                          filterRow.value,
                          handleFilterValueChange,
                        )}
                      </div>
                      <Button
                        type="TETRIARY"
                        className={s.addFilterButton}
                        icon={<DeleteIcon />}
                        onClick={() => handleRemoveFilter(index)}
                        testName="remove-filter-button"
                      >
                        Delete
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </Form>
        </div>
      </Modal>
    </>
  );
}
