import React, { useMemo } from 'react';
import { Button } from 'antd';
import {
  LeftOutlined,
  RightOutlined,
  VerticalLeftOutlined,
  VerticalRightOutlined,
} from '@ant-design/icons';
import pluralize from 'pluralize';
import s from './index.module.less';
import { DEFAULT_PAGE_SIZE } from '@/components/library/Table/consts';
import Select from '@/components/library/Select';
import { Cursor } from '@/utils/queries/types';
import { formatNumber } from '@/utils/number';
import { AsyncResource, getOr, isLoading } from '@/utils/asyncResource';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

interface Props {
  isDisabled?: boolean;
  pageSize?: number;
  onPageChange: (pageSize: number) => void;
  onFromChange: (from: string) => void;
  cursorRes: AsyncResource<Cursor>;
}

export default function CursorPagination(props: Props) {
  const { isDisabled, cursorRes, onPageChange, onFromChange, pageSize = DEFAULT_PAGE_SIZE } = props;

  const isCursorLoading = isLoading(cursorRes);
  const cursor = getOr(cursorRes, null);
  const resultMessage = useMemo(() => {
    let numString: string = '...';
    if (cursor) {
      const { count = 0, limit = 0 } = cursor;
      numString = (
        count >= limit ? `${formatNumber(limit)}+` : formatNumber(count)
      ).toLocaleString();
    }
    return `Found ${numString} ${pluralize('result', cursor?.count ?? 0)}`;
  }, [cursor]);
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
        {resultMessage}
        <Button
          onClick={() => {
            if (cursor) {
              onFromChange('');
            }
          }}
          disabled={isCursorLoading || !cursor?.hasPrev || isDisabled}
          icon={<VerticalRightOutlined />}
        />
        <Button
          onClick={() => {
            onFromChange(cursor?.prev ?? '');
          }}
          disabled={isCursorLoading || !cursor?.hasPrev || isDisabled}
          icon={<LeftOutlined />}
        />
        <Select<number>
          mode="SINGLE"
          isDisabled={isCursorLoading}
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
          onClick={() => {
            if (cursor?.next) {
              onFromChange(cursor?.next);
            }
          }}
          disabled={isCursorLoading || !cursor?.hasNext || isDisabled}
          icon={<RightOutlined />}
          data-cy="pagination-next-button"
        />
        <Button
          onClick={() => {
            if (cursor?.last) {
              onFromChange(cursor.last);
            }
          }}
          disabled={isCursorLoading || !cursor?.hasNext || isDisabled}
          icon={<VerticalLeftOutlined />}
        />
      </div>
    </div>
  );
}
