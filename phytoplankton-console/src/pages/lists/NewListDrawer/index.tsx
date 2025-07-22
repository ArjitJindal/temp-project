import { useCallback, useEffect, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { useMutation } from '@tanstack/react-query';
import cn from 'clsx';
import { humanizeConstant, capitalizeNameFromEmail } from '@flagright/lib/utils/humanize';
import s from './index.module.less';
import NewValueInput from './NewValueInput';
import { useApi } from '@/api';
import { getErrorMessage } from '@/utils/lang';
import { CustomColumn, FileInfo, ListExistedInternal, ListSubtypeInternal, ListType } from '@/apis';
import Button from '@/components/library/Button';
import { BLACKLIST_SUBTYPES, getListSubtypeTitle, WHITELIST_SUBTYPES } from '@/pages/lists/helpers';
import { message } from '@/components/library/Message';
import { useFeatureEnabled, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import Drawer from '@/components/library/Drawer';
import Form, { FormRef } from '@/components/library/Form';
import InputField from '@/components/library/Form/InputField';
import TextInput from '@/components/library/TextInput';
import TextArea from '@/components/library/TextArea';
import Toggle from '@/components/library/Toggle';
import { UseFormState } from '@/components/library/Form/utils';
import { notEmpty } from '@/components/library/Form/utils/validation/basicValidators';
import { DefaultApiPostWhiteListRequest } from '@/apis/types/ObjectParamAPI';
import NumberInput from '@/components/library/NumberInput';
import Alert from '@/components/library/Alert';
import FilesDraggerInput from '@/components/ui/FilesDraggerInput';
import { COLUMN_TYPES } from '@/apis/models-custom/ColumnType';
import { download } from '@/utils/browser';
import { makeUrl } from '@/utils/routing';
import { useAuth0User } from '@/utils/user-utils';
import Select from '@/components/library/Select';

interface FormValues {
  subtype: ListSubtypeInternal | null;
  columns?: CustomColumn[];
  file?: FileInfo;
  name: string;
  description: string;
  status: boolean;
  values: string[];
  ttl: { value?: number; unit: 'HOUR' | 'DAY' };
}

interface Props {
  listType: ListType;
  isOpen: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

const INITIAL_FORM_STATE: FormValues = {
  subtype: null,
  values: [],
  name: '',
  description: '',
  status: false,
  ttl: {
    unit: 'HOUR',
  },
};

export default function NewListDrawer(props: Props) {
  const { isOpen, listType, onCancel, onSuccess } = props;
  const settings = useSettings();
  const [formId] = useState(nanoid());
  const [newColumn, setNewColumn] = useState<CustomColumn>({
    key: '',
    type: 'STRING',
  });
  const api = useApi();

  const auth0User = useAuth0User();
  const formRef = useRef<FormRef<FormValues>>(null);
  const getTemplate = async () => {
    const response = await api.postFlatFilesGenerateTemplate({
      FlatFileTemplateRequest: {
        format: 'CSV',
        schema: 'CUSTOM_LIST_UPLOAD',
        metadata: {
          items:
            formRef.current?.getValues().columns?.map((col) => ({
              key: col.key,
              type: col.type,
            })) ?? [],
          listId: '',
        },
      },
    });

    download(`${listType}-${formRef.current?.getValues().name}.csv`, response.fileString ?? '');
  };

  useEffect(() => {
    if (!isOpen) {
      formRef.current?.resetFields();
    }
  }, [isOpen]);
  const is314aEnabled = useFeatureEnabled('314A');
  const handleFinishMutation = useMutation<
    ListExistedInternal | undefined,
    unknown,
    { values: FormValues }
  >(
    async (event) => {
      const { values } = event;

      if (values.subtype != null) {
        const payload: DefaultApiPostWhiteListRequest = {
          NewListPayload: {
            subtype: values.subtype,
            data: {
              metadata: {
                name: values.name,
                description: values.description,
                status: values.status,
                ttl: values.ttl.value
                  ? { value: values.ttl.value, unit: values.ttl.unit }
                  : undefined,
                columns: values.columns?.map((col) => ({
                  key: col.key,
                  type: col.type,
                })),
              },
              items: values.values?.map((key) => ({ key })) ?? [],
            },
            file: values.file,
          },
        };

        if (listType === 'WHITELIST') {
          return await api.postWhiteList(payload);
        } else {
          return await api.postBlacklist(payload);
        }
      }
    },
    {
      retry: false,
      onSuccess: (list) => {
        if (list) {
          formRef.current?.resetFields(); // todo: implement
          onSuccess();
          message.success(
            `A new ${listType === 'WHITELIST' ? 'whitelist' : 'blacklist'} is created successfully`,
            {
              link: makeUrl(`/lists/:type/:id`, {
                type: listType,
                id: list.listId,
              }),
              linkTitle: 'View list',
              details: `${capitalizeNameFromEmail(auth0User?.name || '')} created a new ${
                listType === 'WHITELIST' ? 'whitelist' : 'blacklist'
              } ${list.header.metadata?.name}`,
              copyFeedback: 'List URL copied to clipboard',
            },
          );
        }
      },
      onError: (error) => {
        message.fatal(`Unable to create list! ${getErrorMessage(error)}`, error);
      },
    },
  );

  const updateColumnField = useCallback(
    (key: string, field: keyof CustomColumn, value: string | undefined) => {
      if (!formRef.current) {
        return;
      }

      const currentValues = formRef.current.getValues();
      const currentColumns = currentValues.columns || [];

      const updatedColumns = currentColumns.map((col: CustomColumn) => {
        if (col.key === key) {
          return { ...col, [field]: value };
        }
        return col;
      });

      formRef.current.setValues({
        ...currentValues,
        columns: updatedColumns,
      });
    },
    [formRef],
  );

  const deleteColumn = useCallback(
    (id: string) => {
      if (!formRef.current) {
        return;
      }

      const currentValues = formRef.current.getValues();
      const currentColumns = currentValues?.columns || [];

      const updatedColumns = currentColumns.filter((col: CustomColumn) => col.key !== id);

      formRef.current?.setValues({
        ...currentValues,
        columns: updatedColumns,
      });
    },
    [formRef],
  );

  const addNewColumn = useCallback(() => {
    if (!formRef.current) {
      return;
    }

    const currentValues = formRef.current.getValues();
    const currentColumns = currentValues?.columns || [];

    const updatedColumns = [...currentColumns, newColumn];

    formRef.current?.setValues({
      ...currentValues,
      columns: updatedColumns,
    });

    setNewColumn({ key: '', type: 'STRING' });
  }, [formRef, newColumn]);

  return (
    <Form<FormValues>
      id={formId}
      ref={formRef}
      onSubmit={(values) => {
        handleFinishMutation.mutate({ values });
      }}
      initialValues={INITIAL_FORM_STATE}
      fieldValidators={{
        subtype: notEmpty,
        name: notEmpty,
      }}
    >
      <Drawer
        title={listType === 'WHITELIST' ? `Add a new whitelist` : `Add a new blacklist`}
        isVisible={isOpen}
        onChangeVisibility={onCancel}
        drawerMaxWidth="800px"
        footer={
          <>
            <UseFormState<FormValues>>
              {({ isValid }) => (
                <div className={s.buttons}>
                  <Button
                    isLoading={handleFinishMutation.isLoading}
                    isDisabled={!isValid}
                    htmlType={'submit'}
                    htmlAttrs={{
                      form: formId,
                    }}
                  >{`Add new ${listType === 'WHITELIST' ? 'whitelist' : 'blacklist'}`}</Button>
                </div>
              )}
            </UseFormState>
          </>
        }
      >
        <div className={s.root}>
          <InputField<FormValues, 'subtype'>
            name="subtype"
            label={`${listType === 'WHITELIST' ? 'Whitelist' : 'Blacklist'} type`}
            labelProps={{ required: { showHint: true, value: true } }}
          >
            {(inputProps) => (
              <Select
                options={(listType === 'WHITELIST' ? WHITELIST_SUBTYPES : BLACKLIST_SUBTYPES)
                  .filter((subtype) => {
                    if (
                      !is314aEnabled &&
                      (subtype === '314A_INDIVIDUAL' || subtype === '314A_BUSINESS')
                    ) {
                      return false;
                    }
                    return true;
                  })
                  .map((subtype) => ({
                    value: subtype,
                    label: getListSubtypeTitle(subtype, settings),
                  }))}
                {...inputProps}
              />
            )}
          </InputField>
          <UseFormState<FormValues>>
            {({ values: { subtype, columns } }) => (
              <>
                {subtype != null && (
                  <>
                    <InputField<FormValues, 'name'>
                      name="name"
                      label={'List name'}
                      labelProps={{ required: { showHint: true, value: true } }}
                    >
                      {(inputProps) => <TextInput {...inputProps} />}
                    </InputField>
                    {!['STRING', 'USER_ID'].includes(subtype) && (
                      <InputField<FormValues, 'values'>
                        name="values"
                        label={getListSubtypeTitle(subtype, settings)}
                      >
                        {(inputProps) => <NewValueInput listSubtype={subtype} {...inputProps} />}
                      </InputField>
                    )}
                    <InputField<FormValues, 'description'> name="description" label={'Description'}>
                      {(inputProps) => <TextArea {...inputProps} />}
                    </InputField>
                    <InputField<FormValues, 'status'>
                      name="status"
                      label={'Status'}
                      labelProps={{ position: 'RIGHT' }}
                    >
                      {(inputProps) => <Toggle size="S" {...inputProps} />}
                    </InputField>
                    <InputField<FormValues, 'ttl'> name="ttl" label={'Expiration time per item'}>
                      {(inputProps) => (
                        <div className={s.ttl}>
                          <NumberInput
                            {...inputProps}
                            value={inputProps.value?.value}
                            onChange={(newValue) => {
                              inputProps.onChange?.({
                                unit: inputProps.value?.unit ?? 'HOUR',
                                value: newValue,
                              });
                            }}
                            placeholder={'Enter the number'}
                          />
                          <Select<FormValues['ttl']['unit']>
                            {...inputProps}
                            value={inputProps.value?.unit || 'HOUR'}
                            onChange={(unit) => {
                              inputProps.onChange?.({
                                value: inputProps.value?.value,
                                unit: unit ?? 'HOUR',
                              });
                            }}
                            options={[
                              { value: 'HOUR', label: 'Hours' },
                              { value: 'DAY', label: 'Days' },
                            ]}
                          />
                        </div>
                      )}
                    </InputField>
                    <Alert type={'INFO'}>
                      <div>
                        1. Expiration time applies to each item independently and is calculated from
                        the time an item is added.
                      </div>
                      <div>
                        2. Expiration time applies only to list items. Items are removed as per
                        above configuration, but the list remains.
                      </div>
                      <div>
                        3. Expiration time settings can't change once set. Create a new list for a
                        new configuration.
                      </div>
                    </Alert>
                    {subtype === 'CUSTOM' && (
                      <>
                        <InputField<FormValues, 'columns'> name="columns" label="Column details">
                          {() => (
                            <div className={s.columnDetailsSection}>
                              <div className={s.columnHeaderFlex}>
                                <div className={cn(s.columnName, s.headerText)}>Column name</div>
                                <div className={cn(s.columnType, s.headerText)}>Column type</div>
                                <div className={cn(s.columnActions, s.headerText)}>Actions</div>
                              </div>
                              {columns?.map((col) => (
                                <div key={col.key} className={s.columnRowFlex}>
                                  <div className={s.columnName}>
                                    <TextInput
                                      value={col.key}
                                      onChange={(newValue) =>
                                        updateColumnField(col.key, 'key', newValue)
                                      }
                                      placeholder="Enter column name"
                                    />
                                  </div>
                                  <div className={s.columnType}>
                                    <Select
                                      value={col.type}
                                      style={{ width: '100%' }}
                                      onChange={(newValue) =>
                                        updateColumnField(col.key, 'type', newValue)
                                      }
                                      options={COLUMN_TYPES.map((type) => ({
                                        value: type,
                                        label: humanizeConstant(type),
                                      }))}
                                    />
                                  </div>
                                  <div className={s.columnActions}>
                                    <Button type="TETRIARY" onClick={() => deleteColumn(col.key)}>
                                      Delete
                                    </Button>
                                  </div>
                                </div>
                              ))}
                              <div className={s.columnRowFlex}>
                                <div className={s.columnName}>
                                  <TextInput
                                    value={newColumn.key}
                                    onChange={(value) =>
                                      setNewColumn((prev) => ({ ...prev, key: value || '' }))
                                    }
                                    placeholder="Select column name"
                                  />
                                </div>
                                <div className={s.columnType}>
                                  <Select
                                    value={newColumn.type ?? undefined}
                                    style={{ width: '100%' }}
                                    onChange={(value) =>
                                      setNewColumn((prev) => ({
                                        ...prev,
                                        type: value ?? 'STRING',
                                      }))
                                    }
                                    placeholder="Select column type"
                                    options={COLUMN_TYPES.map((type) => ({
                                      value: type,
                                      label: humanizeConstant(type),
                                    }))}
                                  />
                                </div>
                                <div className={s.columnActions}>
                                  <Button
                                    type="PRIMARY"
                                    onClick={addNewColumn}
                                    isDisabled={!newColumn.key || !newColumn.type}
                                  >
                                    Add
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </InputField>
                        <InputField<FormValues, 'file'> name="file" label="Upload list">
                          {() => (
                            <FilesDraggerInput
                              singleFile
                              accept={['text/csv']}
                              onChange={(file) => {
                                formRef.current?.setValues({
                                  ...formRef.current?.getValues(),
                                  file: file?.[0],
                                });
                              }}
                            />
                          )}
                        </InputField>
                        <Button
                          type="TETRIARY"
                          size="SMALL"
                          onClick={getTemplate}
                          style={{ width: 'max-content' }}
                          isDisabled={!columns?.length || !formRef.current?.getValues().name}
                        >
                          Download template
                        </Button>
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </UseFormState>
        </div>
      </Drawer>
    </Form>
  );
}
