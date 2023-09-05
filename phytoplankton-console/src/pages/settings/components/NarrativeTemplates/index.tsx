import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card as AntCard } from 'antd';
import s from './style.module.less';
import DrawerFormCreate from './DrawerFormCreate';
import DrawerFormEdit from './DrawerFormEdit';
import Confirm from '@/components/utils/Confirm';
import { H4, P } from '@/components/ui/Typography';
import * as Card from '@/components/ui/Card';
import Button from '@/components/library/Button';
import AddLineIcon from '@/components/ui/icons/Remix/system/add-line.react.svg';
import DeleteLineIcon from '@/components/ui/icons/Remix/system/delete-bin-line.react.svg';
import EditLineIcon from '@/components/ui/icons/Remix/design/edit-line.react.svg';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { useApi } from '@/api';
import { message } from '@/components/library/Message';
import { NarrativeTemplate } from '@/apis';
import { getMutationAsyncResource, useQuery } from '@/utils/queries/hooks';
import { NARRATIVE_TEMPLATE_LIST } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { DEFAULT_PAGE_SIZE } from '@/components/library/Table/consts';
import { CommonParams } from '@/components/library/Table/types';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { LONG_TEXT, STRING } from '@/components/library/Table/standardDataTypes';

const NarrativeTemplates = () => {
  const [paginationParams, setPaginationParams] = useState<CommonParams>({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    sort: [['createdAt', 'descend']],
  });
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [editableNarrative, setEditableNarrative] = useState<string | undefined>(undefined);

  const api = useApi();

  const narrativesQueryResponse = useQuery(NARRATIVE_TEMPLATE_LIST(paginationParams), async () => {
    const { page, pageSize } = paginationParams;
    return await api.getNarratives({ page: page ?? 1, pageSize });
  });

  const deleteNarrativeMutation = useMutation<void, Error, string>(
    async (id) => {
      await api.deleteNarrativeTemplate({
        narrativeTemplateId: id,
      });
    },
    {
      onSuccess: () => {
        message.success('Narrative template deleted');
        narrativesQueryResponse.refetch();
      },
      onError: (error) => {
        message.fatal('Failed to delete narrative template', error);
      },
    },
  );

  const tableHelper = new ColumnHelper<NarrativeTemplate>();
  return (
    <div className="root-settings" style={{ borderRadius: '8px', marginBottom: '10px' }}>
      <AntCard>
        <Card.Column>
          <Card.Row className={s.root}>
            <Card.Column>
              <Card.Row className={s.heading}>
                <H4>Narrative templates</H4>
              </Card.Row>
              <Card.Row>
                <P className={s.paragraph}>
                  Define your own narrative templates to use in your case management.
                </P>
              </Card.Row>
            </Card.Column>
            <AsyncResourceRenderer
              resource={narrativesQueryResponse.data}
              renderLoading={() => null}
            >
              {(data) => {
                return (
                  data.total > 0 && (
                    <Button
                      type="PRIMARY"
                      size="MEDIUM"
                      onClick={() => setIsDrawerVisible(true)}
                      icon={<AddLineIcon />}
                      style={{ height: '100%' }}
                    >
                      Create template
                    </Button>
                  )
                );
              }}
            </AsyncResourceRenderer>
          </Card.Row>
        </Card.Column>
        <AsyncResourceRenderer resource={narrativesQueryResponse.data}>
          {(data) => {
            return data.total === 0 ? (
              <div className={s.cardRootEmpty}>
                <Card.Column>
                  <Card.Row className={s.headingEmptyContainer}>
                    <H4 className={s.headingEmpty}>No templates found</H4>
                  </Card.Row>
                  <Card.Row className={s.headingEmptyParagraphContainer}>
                    <P className={s.paragraphEmpty}>
                      You haven’t added any narrative templates yet. Create a new template using the
                      link below
                    </P>
                  </Card.Row>
                  <Card.Row className={s.buttonContainer}>
                    <Button
                      type="PRIMARY"
                      size="MEDIUM"
                      onClick={() => setIsDrawerVisible(true)}
                      icon={<AddLineIcon />}
                    >
                      Create template
                    </Button>
                  </Card.Row>
                </Card.Column>
              </div>
            ) : (
              <QueryResultsTable<NarrativeTemplate, CommonParams>
                rowKey="id"
                tableId="narrative-templates"
                hideFilters={true}
                params={paginationParams}
                onChangeParams={(params) => {
                  setPaginationParams((prev) => ({
                    page: params.page,
                    pageSize: params.pageSize,
                    sort: prev.sort,
                  }));
                }}
                queryResults={narrativesQueryResponse}
                columns={tableHelper.list([
                  tableHelper.simple({
                    title: 'Name',
                    key: 'name',
                    defaultWidth: 200,
                    type: STRING,
                  }),
                  tableHelper.simple({
                    title: 'Description',
                    key: 'description',
                    defaultWidth: 400,
                    type: LONG_TEXT,
                  }),
                  tableHelper.display({
                    id: 'id',
                    title: 'Status',
                    render: (entity) => (
                      <div className={s.actions}>
                        <Button
                          size="MEDIUM"
                          type="SECONDARY"
                          icon={<EditLineIcon />}
                          onClick={() => {
                            setEditableNarrative(entity.id);
                            setIsDrawerVisible(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Confirm
                          title="Are you sure you want to delete this narrative template?"
                          onConfirm={() => {
                            deleteNarrativeMutation.mutate(entity.id);
                          }}
                          text="Please confirm that you want to delete this narrative template. This action cannot be undone."
                          res={getMutationAsyncResource(deleteNarrativeMutation)}
                        >
                          {({ onClick }) => (
                            <Button
                              size="MEDIUM"
                              type="TETRIARY"
                              icon={<DeleteLineIcon />}
                              onClick={onClick}
                            >
                              Delete
                            </Button>
                          )}
                        </Confirm>
                      </div>
                    ),
                    defaultWidth: 250,
                  }),
                ])}
              />
            );
          }}
        </AsyncResourceRenderer>
        {!editableNarrative ? (
          <DrawerFormCreate
            narrativesQueryResponse={narrativesQueryResponse}
            isDrawerVisible={isDrawerVisible}
            setIsDrawerVisible={setIsDrawerVisible}
          />
        ) : (
          <DrawerFormEdit
            isDrawerVisible={isDrawerVisible}
            setIsDrawerVisible={setIsDrawerVisible}
            setEditableNarrative={setEditableNarrative}
            id={editableNarrative}
            narrativesQueryResponse={narrativesQueryResponse}
          />
        )}
      </AntCard>
    </div>
  );
};

export default NarrativeTemplates;
