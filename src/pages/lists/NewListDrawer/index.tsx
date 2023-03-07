import { useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { Drawer, Form, FormInstance, Input, message, Select, Switch } from 'antd';
import { useMutation } from '@tanstack/react-query';
import s from './index.module.less';
import NewValueInput from './NewValueInput';
import { useApi } from '@/api';
import { getErrorMessage } from '@/utils/lang';
import { ListSubtype, ListType } from '@/apis';
import Button from '@/components/library/Button';
import { getListSubtypeTitle, BLACKLIST_SUBTYPES, WHITELIST_SUBTYPES } from '@/pages/lists/helpers';

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

  const [form] = Form.useForm<FormValues>();
  const [formId] = useState(nanoid());

  const formRef = useRef<FormInstance>(null);
  const listSubtype = Form.useWatch<ListSubtype | null>('subtype', form);

  const api = useApi();
  const handleFinishMutation = useMutation<unknown, unknown, { values: FormValues }>(
    async (event) => {
      const { values } = event;

      if (values.subtype != null) {
        await api.postList({
          NewListPayload: {
            listType,
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
        });
      }
    },
    {
      retry: false,
      onSuccess: () => {
        form.resetFields();
        onSuccess();
        message.success('List created');
      },
      onError: (error) => {
        message.error(`Unable to create list! ${getErrorMessage(error)}`);
      },
    },
  );

  return (
    <Drawer
      title={listType === 'WHITELIST' ? `Add a New Whitelist` : `Add a New Blacklist`}
      visible={isOpen}
      onClose={onCancel}
      bodyStyle={{
        position: 'relative',
      }}
    >
      <Form<FormValues>
        form={form}
        id={formId}
        ref={formRef}
        layout="vertical"
        onFinish={(values) => {
          handleFinishMutation.mutate({ values });
        }}
        initialValues={INITIAL_FORM_STATE}
      >
        <div className={s.root}>
          <div className={s.content}>
            <Form.Item
              name="subtype"
              label={`${listType === 'WHITELIST' ? 'Whitelist' : 'Blacklist'} type`}
              required
            >
              <Select
                options={(listType === 'WHITELIST' ? WHITELIST_SUBTYPES : BLACKLIST_SUBTYPES).map(
                  (subtype) => ({
                    value: subtype,
                    label: getListSubtypeTitle(subtype),
                  }),
                )}
              />
            </Form.Item>
            {listSubtype != null && (
              <>
                <Form.Item name="name" label="List name" required>
                  <Input />
                </Form.Item>
                <Form.Item name="values" label={getListSubtypeTitle(listSubtype)}>
                  <NewValueInput listSubtype={listSubtype} />
                </Form.Item>
                <Form.Item name="description" label="Description">
                  <Input.TextArea />
                </Form.Item>
                <Form.Item name="status" label="Status" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </>
            )}
          </div>
          {listSubtype != null && (
            <div className={s.buttons}>
              <Form.Item<FormValues> noStyle shouldUpdate>
                {({ getFieldsValue }) => {
                  const values = getFieldsValue();
                  const isValid = !!values.name && !!values.subtype;
                  return (
                    <Button
                      isLoading={handleFinishMutation.isLoading}
                      isDisabled={!isValid}
                      htmlType={'submit'}
                    >{`Add new ${listType === 'WHITELIST' ? 'whitelist' : 'blacklist'}`}</Button>
                  );
                }}
              </Form.Item>
            </div>
          )}
        </div>
      </Form>
    </Drawer>
  );
}
