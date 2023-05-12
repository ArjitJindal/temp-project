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
import { CursorActions } from '@/utils/queries/types';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

interface Props {
  isDisabled?: boolean;
  pageSize?: number;
  onPageChange: (pageSize: number) => void;
  onFromChange: (from: string) => void;
  cursorActions: CursorActions;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
}

export default function CursorPagination(props: Props) {
  const {
    isDisabled,
    hasPreviousPage,
    hasNextPage,
    cursorActions,
    onPageChange,
    onFromChange,
    pageSize = DEFAULT_PAGE_SIZE,
  } = props;

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
        <Button
          onClick={() => onFromChange(cursorActions.fetchFirstPage())}
          disabled={!hasPreviousPage || isDisabled}
          icon={<VerticalRightOutlined />}
        />
        <Button
          onClick={() => onFromChange(cursorActions.fetchPreviousPage())}
          disabled={!hasPreviousPage || isDisabled}
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
          onClick={() => onFromChange(cursorActions.fetchNextPage())}
          disabled={!hasNextPage || isDisabled}
          icon={<RightOutlined />}
        ></Button>
        <Button
          onClick={() => onFromChange(cursorActions.fetchLastPage())}
          disabled={!hasNextPage || isDisabled}
          icon={<VerticalLeftOutlined />}
        />
      </div>
    </div>
  );
}
