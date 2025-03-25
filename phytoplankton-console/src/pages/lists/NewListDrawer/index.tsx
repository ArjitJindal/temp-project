import { useEffect, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { Select } from 'antd';
import { useMutation } from '@tanstack/react-query';
import s from './index.module.less';
import NewValueInput from './NewValueInput';
import { useApi } from '@/api';
import { getErrorMessage } from '@/utils/lang';
import { ListSubtype, ListType } from '@/apis';
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

interface FormValues {
  subtype: ListSubtype | null;
  name: string;
  description: string;
  status: boolean;
  values: string[];
  ttl: {
    value?: number;
    unit: 'HOUR' | 'DAY';
  };
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

  const formRef = useRef<FormRef<FormValues>>(null);

  useEffect(() => {
    if (!isOpen) {
      formRef.current?.resetFields();
    }
  }, [isOpen]);
  const is314aEnabled = useFeatureEnabled('314A');
  const api = useApi();
  const handleFinishMutation = useMutation<unknown, unknown, { values: FormValues }>(
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
                  ? {
                      value: values.ttl.value,
                      unit: values.ttl.unit,
                    }
                  : undefined,
              },
              items: values.values?.map((key) => ({ key })) ?? [],
            },
          },
        };

        if (listType === 'WHITELIST') {
          await api.postWhiteList(payload);
        } else {
          await api.postBlacklist(payload);
        }
      }
    },
    {
      retry: false,
      onSuccess: () => {
        formRef.current?.resetFields(); // todo: implement
        onSuccess();
        message.success('List created');
      },
      onError: (error) => {
        message.fatal(`Unable to create list! ${getErrorMessage(error)}`, error);
      },
    },
  );

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
                      (subtype === ('INDIVIDUAL_314' as ListSubtype) ||
                        subtype === ('BUSINESS_314' as ListSubtype))
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
            {({ values: { subtype } }) => (
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
                    {subtype !== 'USER_ID' && (
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
                    <InputField<FormValues, 'ttl'> name="ttl" label={'Item expiration time'}>
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
                            value={inputProps.value?.unit}
                            onChange={(unit) => {
                              inputProps.onChange?.({
                                value: inputProps.value?.value,
                                unit,
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
