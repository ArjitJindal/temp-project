import { describe, expect, test } from '@jest/globals';
import { act, render, screen } from 'testing-library-wrapper';
import CaseTable from '..';
import { TableSearchParams } from '../../types';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { success } from '@/utils/asyncResource';
import SettingsProviderMock_ from '@/components/AppWrapper/Providers/mocks/SettingsProvider';
import { Case, DerivedStatus, Feature } from '@/apis';
import { AllParams } from '@/components/library/Table/types';
import { PaginatedData } from '@/utils/queries/hooks';
import { QueryResult } from '@/utils/queries/types';

describe('Case Table Component', () => {
  interface FirstProps {}
  interface SecondProps {}

  interface MockProps {
    params?: AllParams<TableSearchParams>;
    queryResult?: QueryResult<PaginatedData<Case>>;
    onChangeParams?: (newState: AllParams<TableSearchParams>) => void;
    rules?: { value: string; label: string }[];
    features?: Feature[];
  }

  const renderComponent = async (props: MockProps) => {
    const { params, queryResult, onChangeParams, rules, features } = props;

    await act(() => {
      render(
        <SettingsProviderMock_ features={features}>
          <CaseTable<FirstProps, SecondProps>
            params={params ?? DEFAULT_PARAMS_STATE}
            onChangeParams={onChangeParams ?? (() => {})}
            queryResult={
              queryResult ?? {
                refetch: () => {},
                data: success({
                  items: [],
                }),
              }
            }
            rules={rules ?? []}
            updateFirstModalState={() => {}}
            setFirstModalVisibility={() => {}}
            updateSecondModalState={() => {}}
            setSecondModalVisibility={() => {}}
          />
        </SettingsProviderMock_>,
      );
    });
  };

  test(`Required columns are rendered on disabling all feature flags without any case status set`, async () => {
    const columns = [
      'Case ID',
      'Created at',
      'User ID',
      'User name',
      'Transactions hit',
      'User status',
      'KYC status',
      'Assigned to',
      'Case status',
      'Last updated',
      'Proposed action',
      'Proposed by',
      'Operations',
      'Reason',
      'Status changed by',
    ];

    await renderComponent({});

    for (const column of columns) {
      const columnElement = await findColumn(column);
      expect(columnElement).toBeInTheDocument();
    }
  });

  test('Required columns are rendered on setting the PNB feature flag', async () => {
    const columns = [
      'Case ID',
      'Created at',
      'User ID',
      'User name',
      'Transactions hit',
      'User status',
      'KYC status',
      'Assigned to',
      'Case status',
      'Last updated',
      'SLA status',
      'Proposed action',
      'Proposed by',
      'Operations',
      'Reason',
      'Status changed by',
    ];
    await renderComponent({ features: ['PNB'] });

    for (const column of columns) {
      const columnElement = await findColumn(column);
      expect(columnElement).toBeInTheDocument();
    }
  });

  test('Required columns are rendered on setting the Risk scoring feature flag', async () => {
    const columns = [
      'Case ID',
      'Created at',
      'User ID',
      'User name',
      'Transactions hit',
      'User status',
      'KYC status',
      'Assigned to',
      'Case status',
      'Last updated',
      'Proposed action',
      'Proposed by',
      'Operations',
      'Reason',
      'Status changed by',
    ];
    await renderComponent({ features: ['RISK_SCORING'] });

    for (const column of columns) {
      const columnElement = await findColumn(column);
      expect(columnElement).toBeInTheDocument();
    }
  });

  test('Required columns are rendered on enabling the Risk levels feature flag', async () => {
    const columns = [
      'Case ID',
      'Created at',
      'User ID',
      'User name',
      'Transactions hit',
      'User status',
      'KYC status',
      'User risk level',
      'Assigned to',
      'Case status',
      'Last updated',
      'Proposed action',
      'Proposed by',
      'Operations',
      'Reason',
      'Status changed by',
    ];

    await renderComponent({ features: ['RISK_LEVELS'] });

    for (const column of columns) {
      const columnElement = await findColumn(column);
      expect(columnElement).toBeInTheDocument();
    }
  });

  test('Render all the columns when case status is set to Open', async () => {
    const columns = [
      'Case ID',
      'Created at',
      'User ID',
      'User name',
      'Transactions hit',
      'User status',
      'KYC status',
      'Assigned to',
      'Case status',
      'Last updated',
      'Operations',
    ];

    const mockParams = {
      ...DEFAULT_PARAMS_STATE,
      caseStatus: ['OPEN'] as DerivedStatus[],
      alertStatus: null,
    };

    await renderComponent({ params: mockParams });

    for (const column of columns) {
      const columnElement = await findColumn(column);
      expect(columnElement).toBeInTheDocument();
    }
  });

  test('Columns are rendered when the case is in review', async () => {
    const columns = [
      'Case ID',
      'Created at',
      'User ID',
      'User name',
      'Transactions hit',
      'User status',
      'KYC status',
      'Assigned to',
      'Case status',
      'Last updated',
      'Proposed action',
      'Proposed by',
      'Operations',
      'Reason',
      'Status changed by',
    ];

    const mockParams = {
      ...DEFAULT_PARAMS_STATE,
      caseStatus: ['IN_REVIEW'] as DerivedStatus[],
      alertStatus: null,
    };

    await renderComponent({ params: mockParams });

    for (const column of columns) {
      const columnElement = await findColumn(column);
      expect(columnElement).toBeInTheDocument();
    }
  });
});

/*
  Helpers
*/

async function findColumn(title: string) {
  return await screen.queryByRole('columnheader', { name: `"${title}" column header` });
}
