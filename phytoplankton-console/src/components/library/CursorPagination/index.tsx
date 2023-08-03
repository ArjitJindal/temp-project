import React from 'react';
import { Button } from 'antd';
import {
  LeftOutlined,
  RightOutlined,
  VerticalLeftOutlined,
  VerticalRightOutlined,
} from '@ant-design/icons';
import s from './index.module.less';
import { DEFAULT_PAGE_SIZE } from '@/components/library/Table/consts';
import Select from '@/components/library/Select';
import { Cursor } from '@/utils/queries/types';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

interface Props {
  isDisabled?: boolean;
  pageSize?: number;
  onPageChange: (pageSize: number) => void;
  onFromChange: (from: string) => void;
  cursor: Cursor;
}

export default function CursorPagination(props: Props) {
  const { isDisabled, cursor, onPageChange, onFromChange, pageSize = DEFAULT_PAGE_SIZE } = props;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
        alignItems: 'center',
        backgroundColor: 'white',
      }}
    >
      <div className={s.root}>
        Found {(cursor.count > cursor.limit ? `${cursor.limit}+` : cursor.count).toLocaleString()}{' '}
        results
        <Button
          onClick={() => onFromChange(cursor.fetchFirstPage())}
          disabled={!cursor.hasPrev || isDisabled}
          icon={<VerticalRightOutlined />}
        />
        <Button
          onClick={() => onFromChange(cursor.fetchPreviousPage())}
          disabled={!cursor.hasPrev || isDisabled}
          icon={<LeftOutlined />}
        />
        <Select<number>
          mode="SINGLE"
          onChange={(value) => {
            onPageChange(value ?? DEFAULT_PAGE_SIZE);
          }}
          value={pageSize}
          options={PAGE_SIZE_OPTIONS.map((pageSize) => ({
            value: pageSize,
            label: `${pageSize} / page`,
          }))}
          dropdownPlacement="topRight"
        />
        <Button
          onClick={() => onFromChange(cursor.fetchNextPage())}
          disabled={!cursor.hasNext || isDisabled}
          icon={<RightOutlined />}
          data-cy="pagination-next-button"
        ></Button>
        <Button
          onClick={() => onFromChange(cursor.fetchLastPage())}
          disabled={!cursor.hasNext || isDisabled}
          icon={<VerticalLeftOutlined />}
        />
      </div>
    </div>
  );
}
