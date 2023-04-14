import { useCallback, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import DrawerForm from './DrawerForm';
import { FormValues } from './type';
import NarrativeForm from './NarrativeForm';
import { useApi } from '@/api';
import { message } from '@/components/library/Message';
import { NarrativeTemplate, NarrativeTemplateResponse } from '@/apis';
import { useQuery } from '@/utils/queries/hooks';
import { NARRATIVE_TEMPLATE_ITEM } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { QueryResult } from '@/utils/queries/types';

type DrawerFormEditProps = {
  isDrawerVisible: boolean;
  setIsDrawerVisible: React.Dispatch<React.SetStateAction<boolean>>;
  id: string;
  setEditableNarrative: React.Dispatch<React.SetStateAction<string | undefined>>;
  narrativesQueryResponse: QueryResult<NarrativeTemplateResponse>;
};

const DrawerFormEdit = (props: DrawerFormEditProps) => {
  const { id, isDrawerVisible, setIsDrawerVisible, setEditableNarrative, narrativesQueryResponse } =
    props;
  const api = useApi();

  const narrativeQueryResponse = useQuery(NARRATIVE_TEMPLATE_ITEM(id), async () => {
    return await api.getNarrativeTemplate({
      narrativeTemplateId: id,
    });
  });

  const narrativesUpdateMutation = useMutation<NarrativeTemplate, unknown, FormValues>(
    async (values): Promise<NarrativeTemplate> => {
      return await api.putNarrativeTemplate({
        narrativeTemplateId: id,
        NarrativeTemplateRequest: {
          name: values.name,
          description: values.description,
        },
      });
    },
    {
      onSuccess: async (_) => {
        narrativeQueryResponse.refetch();
        narrativesQueryResponse.refetch();
        message.success('Narrative template successfully updated!');
      },
      onError: (error) => {
        message.fatal('Failed to update narrative template', error);
      },
    },
  );

  const onSubmit = useCallback(
    (values: FormValues) => {
      if (values.name.length === 0 || values.description.length === 0) {
        message.error('Please fill in all fields');
        return;
      }

      narrativesUpdateMutation.mutate(values);
    },
    [narrativesUpdateMutation],
  );

  const submitRef = useRef<HTMLButtonElement>(null);

  return (
    <DrawerForm
      isEditDrawer={true}
      submitRef={submitRef}
      isDrawerVisible={isDrawerVisible}
      onChangeVisibility={() => {
        setIsDrawerVisible(false);
        setEditableNarrative(undefined);
      }}
    >
      <AsyncResourceRenderer resource={narrativeQueryResponse.data}>
        {(narrativeTemplate) => {
          return (
            <NarrativeForm
              values={{
                name: narrativeTemplate.name,
                description: narrativeTemplate.description,
              }}
              submitRef={submitRef}
              onSubmit={onSubmit}
            />
          );
        }}
      </AsyncResourceRenderer>
    </DrawerForm>
  );
};

export default DrawerFormEdit;
