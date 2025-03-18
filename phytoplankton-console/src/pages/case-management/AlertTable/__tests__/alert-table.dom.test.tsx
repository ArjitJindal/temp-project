import { describe, test, expect } from '@jest/globals';
import { act, render, screen } from 'testing-library-wrapper';
import { ModalProps } from 'antd';
import AlertTable, { AlertTableParams } from '../';
import SettingsProviderMock_ from '@/components/AppWrapper/Providers/mocks/SettingsProvider';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import RouterProvider from '@/components/AppWrapper/Providers/mocks/RouterProvider';
import { Feature, DerivedStatus } from '@/apis';
describe('Tests for checking rendering of output dom tree in alerts table', () => {
  interface mockModalProps {
    params?: AlertTableParams;
    onChangeParams?: (newState: AlertTableParams) => void;
    showUserFilters?: boolean;
    updateModalState?: (newState: ModalProps) => void;
    setModalVisibility?: (visibility: boolean) => void;
    features?: Feature[];
  }

  const renderComponent = async (props: mockModalProps) => {
    const { params, onChangeParams, features, showUserFilters } = props;

    await act(() => {
      render(
        <RouterProvider>
          <SettingsProviderMock_ features={features}>
            <AlertTable<ModalProps>
              params={params ?? DEFAULT_PARAMS_STATE}
              onChangeParams={onChangeParams ?? (() => {})}
              showUserFilters={showUserFilters}
              updateModalState={() => {}}
              setModalVisibility={() => {}}
            />
          </SettingsProviderMock_>
          ,
        </RouterProvider>,
      );
    });
  };

  test('All the columns are rendered without setting any feature flag and passing no params', async () => {
    const columns = [
      'Alert ID',
      'Case ID',
      'Created at',
      'Alert age',
      '#TX',
      'Rule name',
      'Rule description',
      'Rule action',
      'Rule nature',
      'Alert status',
      'Case created at',
      'Last updated',
      'Assigned to',
      'Queue',
      'Reason',
      'Status changed by',
      'Operations',
    ];

    await renderComponent({ showUserFilters: false });

    const colNames = screen
      .getAllByRole('columnheader')
      .map((th) => th.textContent)
      .filter((item) => item !== '');

    expect(colNames).toEqual(columns);
  });

  test('Columns are rendered on setting the user filters to true', async () => {
    const columns = [
      'Alert ID',
      'Case ID',
      'Created at',
      'Alert age',
      '#TX',
      'User id',
      'User name',
      'Rule name',
      'Rule description',
      'Rule action',
      'Rule nature',
      'Alert status',
      'Case created at',
      'Last updated',
      'Assigned to',
      'Queue',
      'Reason',
      'Status changed by',
      'Operations',
    ];

    await renderComponent({ showUserFilters: true });

    const colNames = screen
      .getAllByRole('columnheader')
      .map((th) => th.textContent)
      .filter((item) => item !== '');

    expect(colNames).toEqual(columns);
  });

  test('Columns are rendered on setting the ALERT_SLA feature flag', async () => {
    const columns = [
      'Alert ID',
      'Case ID',
      'Created at',
      'Alert age',
      '#TX',
      'Rule name',
      'Rule description',
      'Rule action',
      'Rule nature',
      'SLA status',
      'Alert status',
      'Case created at',
      'Last updated',
      'Assigned to',
      'Queue',
      'Reason',
      'Status changed by',
      'Operations',
    ];

    await renderComponent({ showUserFilters: false, features: ['ALERT_SLA'] });

    const colNames = screen
      .getAllByRole('columnheader')
      .map((th) => th.textContent)
      .filter((item) => item !== '');

    expect(colNames).toEqual(columns);
  });

  test('Columns are rendered on setting alert status as open', async () => {
    const columns = [
      'Alert ID',
      'Case ID',
      'Created at',
      'Alert age',
      '#TX',
      'Rule name',
      'Rule description',
      'Rule action',
      'Rule nature',
      'Alert status',
      'Case created at',
      'Last updated',
      'Assigned to',
      'Queue',
      'Status changed by',
      'Operations',
    ];

    const mockParams = {
      ...DEFAULT_PARAMS_STATE,
      caseStatus: null,
      alertStatus: ['OPEN'] as DerivedStatus[],
    };

    await renderComponent({ showUserFilters: false, params: mockParams });

    const colNames = screen
      .getAllByRole('columnheader')
      .map((th) => th.textContent)
      .filter((item) => item !== '');

    expect(colNames).toEqual(columns);
  });

  test('Columns are rendered on setting alert status is closed', async () => {
    const columns = [
      'Alert ID',
      'Case ID',
      'Created at',
      'Alert age',
      '#TX',
      'Rule name',
      'Rule description',
      'Rule action',
      'Rule nature',
      'Alert status',
      'Case created at',
      'Last updated',
      'Assigned to',
      'Queue',
      'Reason',
      'Status changed by',
      'Operations',
    ];

    const mockParams = {
      ...DEFAULT_PARAMS_STATE,
      caseStatus: null,
      alertStatus: ['CLOSED'] as DerivedStatus[],
    };

    await renderComponent({ showUserFilters: false, params: mockParams });

    const colNames = screen
      .getAllByRole('columnheader')
      .map((th) => th.textContent)
      .filter((item) => item !== '');

    expect(colNames).toEqual(columns);
  });

  test('Columns are rendered on setting alert status is in review', async () => {
    const columns = [
      'Alert ID',
      'Case ID',
      'Created at',
      'Alert age',
      '#TX',
      'Rule name',
      'Rule description',
      'Rule action',
      'Rule nature',
      'Alert status',
      'Case created at',
      'Last updated',
      'Assigned to',
      'Queue',
      'Proposed action',
      'Proposed by',
      'Reason',
      'Operations',
    ];

    const mockParams = {
      ...DEFAULT_PARAMS_STATE,
      caseStatus: null,
      alertStatus: ['IN_REVIEW'] as DerivedStatus[],
    };

    await renderComponent({ showUserFilters: false, params: mockParams });

    const colNames = screen
      .getAllByRole('columnheader')
      .map((th) => th.textContent)
      .filter((item) => item !== '');

    expect(colNames).toEqual(columns);
  });

  // Same tests will check for On hold , esclated L2 and remaining status

  test('Columns are rendered on setting alert status is in progress', async () => {
    const columns = [
      'Alert ID',
      'Case ID',
      'Created at',
      'Alert age',
      '#TX',
      'Rule name',
      'Rule description',
      'Rule action',
      'Rule nature',
      'Alert status',
      'Case created at',
      'Last updated',
      'Assigned to',
      'Queue',
      'Reason',
      'Status changed by',
      'Operations',
    ];

    const mockParams = {
      ...DEFAULT_PARAMS_STATE,
      caseStatus: null,
      alertStatus: ['IN_PROGRESS'] as DerivedStatus[],
    };

    await renderComponent({ showUserFilters: false, params: mockParams });

    const colNames = screen
      .getAllByRole('columnheader')
      .map((th) => th.textContent)
      .filter((item) => item !== '');

    expect(colNames).toEqual(columns);
  });
});
