import { useNavigate, useParams } from 'react-router';
import { useEffect, useRef, useState } from 'react';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import s from './style.module.less';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';
import PageWrapper from '@/components/PageWrapper';
import Breadcrumbs from '@/components/library/Breadcrumbs';
import { notEmpty } from '@/utils/array';
import * as Card from '@/components/ui/Card';
import SegmentedControl from '@/components/library/SegmentedControl';
import { makeUrl } from '@/utils/routing';
import Button from '@/components/library/Button';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { RISK_FACTORS_V8 } from '@/utils/queries/keys';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { RiskFactor, RuleInstanceStatus } from '@/apis';
import { TableColumn, TableRefType } from '@/components/library/Table/types';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { map } from '@/utils/queries/types';
import { BOOLEAN, DATE_TIME, STRING } from '@/components/library/Table/standardDataTypes';
import Confirm from '@/components/utils/Confirm';
import { useHasPermissions } from '@/utils/user-utils';
import { message } from '@/components/library/Message';
import { getMutationAsyncResource } from '@/utils/queries/mutations/helpers';
import Id from '@/components/ui/Id';
import { RuleStatusSwitch } from '@/pages/rules/components/RuleStatusSwitch';

export default function () {
  const { type = 'consumer' } = useParams();
  return (
    <Feature name="RISK_SCORING_V8" fallback={'Not enabled'}>
      <PageWrapper
        header={
          <Breadcrumbs
            items={[
              {
                title: 'Custom Risk Factors',
                to: '/risk-levels/custom-risk-factors',
              },
              type === 'consumer' && {
                title: 'Consumer',
                to: '/risk-levels/custom-risk-factors/consumer',
              },
              type === 'business' && {
                title: 'Business',
                to: '/risk-levels/custom-risk-factors/business',
              },
              type === 'transaction' && {
                title: 'Transaction',
                to: '/risk-levels/custom-risk-factors/transaction',
              },
            ].filter(notEmpty)}
          />
        }
      >
        <CustomRiskFactors type={type} />
      </PageWrapper>
    </Feature>
  );
}
interface Props {
  type: string;
}
type ScopeSelectorValue = 'consumer' | 'business' | 'transaction';
const CustomRiskFactors = (props: Props) => {
  const { type } = props;
  const [selectedSection, setSelectedSection] = useState<ScopeSelectorValue>(
    type as ScopeSelectorValue,
  );
  const [updatedRiskFactor, setUpdatedRiskFactor] = useState<{ [key: string]: RiskFactor }>({});
  const canWriteRiskFactors = useHasPermissions(['risk-scoring:risk-factors:write']);
  const navigate = useNavigate();
  useEffect(() => {
    navigate(makeUrl(`/risk-levels/custom-risk-factors/:type`, { type: selectedSection }), {
      replace: true,
    });
  }, [selectedSection, navigate]);
  const api = useApi();
  const queryResult = useQuery(RISK_FACTORS_V8(type), async () => {
    const entityType =
      type === 'consumer' ? 'CONSUMER_USER' : type === 'business' ? 'BUSINESS' : 'TRANSACTION';
    return await api.getAllRiskFactors({
      entityType: entityType,
    });
  });
  const queryClient = useQueryClient();
  const handleActivationChangeMutation = useMutation<
    RiskFactor,
    Error,
    { id: string; status: RuleInstanceStatus }
  >(
    async ({ id, status }) => {
      return await api.putRiskFactors({
        riskFactorId: id,
        RiskFactorsUpdateRequest: {
          status: status,
        },
      });
    },
    {
      onSuccess: async (data) => {
        await queryClient.invalidateQueries(RISK_FACTORS_V8(type));
        setUpdatedRiskFactor((prev) => ({ ...prev, [data.id]: data }));
        message.success(`Risk factor updated`);
      },
      onError: async (err) => {
        message.fatal(`Unable to update the risk factor - Some parameters are missing`, err);
      },
    },
  );
  const deleteRiskFactorMutation = useMutation<void, Error, string>(
    async (riskFactorId) => {
      return api.deleteRiskFactor({
        riskFactorId,
      });
    },
    {
      onSuccess: async () => {
        await queryClient.invalidateQueries(RISK_FACTORS_V8(type));
        message.success(`Risk factor deleted`);
      },
      onError: async (err) => {
        message.fatal(`Unable to delete the risk factor - Some parameters are missing`, err);
      },
    },
  );
  const actionRef = useRef<TableRefType>(null);
  const columnHelper = new ColumnHelper<RiskFactor>();
  const columns: TableColumn<RiskFactor>[] = columnHelper.list([
    columnHelper.simple<'id'>({
      title: 'Risk factor ID',
      key: 'id',
      type: {
        render: (id) => {
          return (
            <Id
              to={makeUrl(`/risk-levels/custom-risk-factors/:type/:id/read`, {
                type: selectedSection,
                id,
              })}
            >
              {id}
            </Id>
          );
        },
      },
    }),
    columnHelper.simple<'name'>({
      title: 'Risk factor name',
      key: 'name',
      type: STRING,
    }),
    columnHelper.simple<'description'>({
      title: 'Risk factor description',
      key: 'description',
      type: STRING,
      defaultWidth: 300,
    }),
    columnHelper.simple<'updatedAt'>({
      title: 'Last updated at',
      key: 'updatedAt',
      type: DATE_TIME,
    }),
    columnHelper.derived<boolean>({
      id: 'enabled',
      title: 'Enabled',
      defaultSticky: 'RIGHT',
      value: (row) => row.status === 'ACTIVE',
      defaultWidth: 70,
      type: {
        ...BOOLEAN,
        render: (_, { item: entity }) => {
          if (!entity.id) {
            return <></>;
          }
          const riskFactor = updatedRiskFactor[entity.id] || entity;
          return (
            <RuleStatusSwitch
              entity={riskFactor}
              type="RISK_FACTOR"
              onToggle={(checked) =>
                handleActivationChangeMutation.mutate({
                  id: entity.id,
                  status: checked ? 'ACTIVE' : 'INACTIVE',
                })
              }
            />
          );
        },
      },
    }),
    columnHelper.display({
      id: 'actions',
      title: 'Action',
      defaultSticky: 'RIGHT',
      defaultWidth: 250,
      enableResizing: false,
      render: (entity) => {
        return (
          <div className={s.actionIconsContainer}>
            <Button
              onClick={() => {
                navigate(
                  makeUrl(`/risk-levels/custom-risk-factors/:type/:id/edit`, {
                    type: selectedSection,
                    id: entity.id,
                  }),
                  { replace: true },
                );
              }}
              icon={<EditOutlined />}
              size="MEDIUM"
              type="SECONDARY"
              isDisabled={!canWriteRiskFactors}
              isLoading={deleteRiskFactorMutation.isLoading}
              testName="risk-factor-edit-button"
            >
              Edit
            </Button>
            <Confirm
              title={`Are you sure you want to delete this ${entity.id} ${entity.name} risk factor?`}
              text="Please confirm that you want to delete this risk factor. This action cannot be undone."
              onConfirm={() => {
                if (canWriteRiskFactors && entity.id) {
                  deleteRiskFactorMutation.mutate(entity.id);
                }
              }}
              res={getMutationAsyncResource(deleteRiskFactorMutation)}
            >
              {({ onClick }) => (
                <Button
                  onClick={onClick}
                  icon={<DeleteOutlined />}
                  size="SMALL"
                  type="TETRIARY"
                  isDisabled={!canWriteRiskFactors}
                  isLoading={deleteRiskFactorMutation.isLoading}
                  testName="risk-factor-delete-button"
                >
                  Delete
                </Button>
              )}
            </Confirm>
          </div>
        );
      },
    }),
  ]);
  return (
    <Card.Root noBorder>
      <Card.Section>
        <div className={s.header}>
          <SegmentedControl<ScopeSelectorValue>
            size="MEDIUM"
            active={selectedSection}
            onChange={(newValue) => {
              setSelectedSection(newValue);
            }}
            items={[
              { value: 'consumer', label: 'Consumer' },
              { value: 'business', label: 'Business' },
              { value: 'transaction', label: 'Transaction' },
            ]}
          />
          <Button
            size="MEDIUM"
            type="SECONDARY"
            onClick={() => {
              navigate(
                makeUrl(`/risk-levels/custom-risk-factors/:type/create`, { type: selectedSection }),
                { replace: true },
              );
            }}
          >
            Create risk factor
          </Button>
        </div>
        <QueryResultsTable<RiskFactor>
          rowKey="id"
          tableId={`custom-risk-factors-${type}`}
          innerRef={actionRef}
          queryResults={map(queryResult, (data) => ({
            items: data,
          }))}
          columns={columns}
          pagination={false}
          toolsOptions={false}
        />
      </Card.Section>
    </Card.Root>
  );
};
