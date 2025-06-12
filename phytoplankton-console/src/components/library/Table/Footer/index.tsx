import React from 'react';
import pluralize from 'pluralize';
import * as TanTable from '@tanstack/react-table';
import { AllParams, SelectionAction, TableRow } from '../types';
import SelectionActions from '../Header/SelectionActions';
import Checkbox from '../../Checkbox';
import Tooltip, { Props as TooltipProps } from '../../Tooltip';
import s from './index.module.less';
import InformationLineIcon from '@/components/ui/icons/Remix/system/information-line.react.svg';
import { DEFAULT_BULK_ACTIONS_LIMIT } from '@/utils/table-utils';

interface Props<Item extends object, Params extends object> {
  table: TanTable.Table<TableRow<Item>>;
  selectionActions?: SelectionAction<Item, Params>[];
  params: AllParams<Params>;
  onChangeParams: (newParams: AllParams<Params>) => void;
  selectionInfo?: {
    entityName: string;
    entityCount: number;
  };
}

export default function Footer<Item extends object, Params extends object>(
  props: Props<Item, Params>,
) {
  const { table, selectionActions = [], params, onChangeParams, selectionInfo } = props;

  const tooltipProps: TooltipProps = {
    title: `You can select a maximum of ${DEFAULT_BULK_ACTIONS_LIMIT} rows`,
    ...((selectionInfo?.entityCount ?? 0) >= DEFAULT_BULK_ACTIONS_LIMIT && {
      defaultVisible: true,
    }),
  };

  const showSelectionActions =
    selectionActions.length > 0 && Object.keys(table.getState().rowSelection).length > 0;

  const showSelectionInfo = selectionInfo != null && selectionInfo.entityCount > 0;

  if (!showSelectionInfo && !showSelectionActions) {
    return <></>;
  }

  return (
    <div className={s.tableSelectionFooter} data-cy="table-footer">
      {showSelectionInfo && (
        <div className={s.selectionInfo} data-cy="selection-info">
          {' '}
          <Checkbox value={true} />
          <span data-cy="selection-info-text">
            {pluralize(selectionInfo.entityName, selectionInfo.entityCount, true)} selected{' '}
          </span>
          <Tooltip {...tooltipProps} trigger="click">
            <InformationLineIcon className={s.tooltipIcon} />
          </Tooltip>
        </div>
      )}
      {showSelectionActions && (
        <div className={s.selectionActions}>
          <SelectionActions
            table={table}
            params={params}
            onChangeParams={(cb) => {
              onChangeParams(cb(params));
            }}
            actions={selectionActions}
          />
        </div>
      )}
    </div>
  );
}
