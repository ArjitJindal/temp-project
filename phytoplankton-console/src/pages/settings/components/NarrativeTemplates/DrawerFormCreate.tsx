import { useCallback, useMemo, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { FormValues } from './type';
import DrawerForm from './DrawerForm';
import NarrativeForm from './NarrativeForm';
import { useApi } from '@/api';
import { message } from '@/components/library/Message';
import { NarrativeTemplate, NarrativeTemplateResponse } from '@/apis';
import { QueryResult } from '@/utils/queries/types';
import { FormRef } from '@/components/library/Form';

type DrawerFormCreateProps = {
  narrativesQueryResponse: QueryResult<NarrativeTemplateResponse>;
  isDrawerVisible: boolean;
  setIsDrawerVisible: React.Dispatch<React.SetStateAction<boolean>>;
};

const DrawerFormCreate = (props: DrawerFormCreateProps) => {
  const { narrativesQueryResponse, isDrawerVisible, setIsDrawerVisible } = props;

  const api = useApi();

  const initialValues: FormValues = useMemo(() => {
    return {
      name: '',
      description: '',
    };
  }, []);

  const formRef = useRef<FormRef<FormValues>>(null);

  const narrativesCreateMutation = useMutation<NarrativeTemplate, unknown, FormValues>(
    async (values): Promise<NarrativeTemplate> => {
      return await api.postNarrativeTemplate({
        NarrativeTemplateRequest: {
          name: values.name,
          description: values.description,
        },
      });
    },
    {
      onSuccess: async (_) => {
        narrativesQueryResponse.refetch();
        formRef.current?.setValues(initialValues);
        message.success('Narrative template successfully added!');
      },
      onError: (error) => {
        message.fatal('Failed to create narrative template', error);
      },
    },
  );

  const onSubmit = useCallback(
    (values: FormValues) => {
      if (values.name.length === 0 || values.description.length === 0) {
        message.error('Please fill in all fields');
        return;
      }

      narrativesCreateMutation.mutate(values);
    },
    [narrativesCreateMutation],
  );

  const submitRef = useRef<HTMLButtonElement>(null);

  return (
    <DrawerForm
      isEditDrawer={false}
      submitRef={submitRef}
      isDrawerVisible={isDrawerVisible}
      onChangeVisibility={(visible) => {
        setIsDrawerVisible(visible);
        formRef.current?.setValues(initialValues);
      }}
    >
      <NarrativeForm
        values={initialValues}
        onSubmit={onSubmit}
        submitRef={submitRef}
        formRef={formRef}
      />
    </DrawerForm>
  );
};

export default DrawerFormCreate;
