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
import Drawer from '@/components/library/Drawer';
import Form, { FormRef } from '@/components/library/Form';
import InputField from '@/components/library/Form/InputField';
import TextInput from '@/components/library/TextInput';
import TextArea from '@/components/library/TextArea';
import Toggle from '@/components/library/Toggle';
import { UseFormState } from '@/components/library/Form/utils';
import { notEmpty } from '@/components/library/Form/utils/validation/basicValidators';
import { DefaultApiPostWhiteListRequest } from '@/apis/types/ObjectParamAPI';

interface FormValues {
  subtype: ListSubtype | null;
  name: string;
  description: string;
  status: boolean;
  values: string[];
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
};

export default function NewListDrawer(props: Props) {
  const { isOpen, listType, onCancel, onSuccess } = props;

  const [formId] = useState(nanoid());

  const formRef = useRef<FormRef<FormValues>>(null);

  useEffect(() => {
    if (!isOpen) {
      formRef.current?.resetFields();
    }
  }, [isOpen]);

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
              },
              items: values.values?.map((key) => ({ key })) ?? [],
            },
          },
        };

        listType === 'WHITELIST' ? api.postWhiteList(payload) : api.postBlacklist(payload);
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
          >
            {(inputProps) => (
              <Select
                options={(listType === 'WHITELIST' ? WHITELIST_SUBTYPES : BLACKLIST_SUBTYPES).map(
                  (subtype) => ({
                    value: subtype,
                    label: getListSubtypeTitle(subtype),
                  }),
                )}
                {...inputProps}
              />
            )}
          </InputField>
          <UseFormState<FormValues>>
            {({ values: { subtype } }) => (
              <>
                {subtype != null && (
                  <>
                    <InputField<FormValues, 'name'> name="name" label={'List name'}>
                      {(inputProps) => <TextInput {...inputProps} />}
                    </InputField>
                    {subtype !== 'USER_ID' && (
                      <InputField<FormValues, 'values'>
                        name="values"
                        label={getListSubtypeTitle(subtype)}
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
