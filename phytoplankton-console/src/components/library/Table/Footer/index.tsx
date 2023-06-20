import React from 'react';
import pluralize from 'pluralize';
import * as TanTable from '@tanstack/react-table';
import { AllParams, SelectionAction, TableRow } from '../types';
import SelectionActions from '../Header/SelectionActions';
import Checkbox from '../../Checkbox';
import s from './index.module.less';

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
  const { table, selectionActions, params, onChangeParams, selectionInfo } = props;
  return (
    <div className={s.tableSelectionFooter} data-cy="table-footer">
      {selectionInfo && (
        <div className={s.selectionInfo}>
          {' '}
          <Checkbox value={true} />
          {pluralize(selectionInfo.entityName, selectionInfo.entityCount, true)} selected
        </div>
      )}
      <div className={s.selectionActions}>
        <SelectionActions
          table={table}
          params={params}
          onChangeParams={(cb) => {
            onChangeParams(cb(params));
          }}
          actions={selectionActions ?? []}
        />
      </div>
    </div>
  );
}
