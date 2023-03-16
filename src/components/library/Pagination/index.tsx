import React from 'react';
import { Pagination as AntPagination } from 'antd';
import s from './index.module.less';
import { DEFAULT_PAGE_SIZE } from '@/components/ui/Table/consts';
import Select from '@/components/library/Select';
import COLORS from '@/components/ui/colors';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

interface Props {
  isDisabled?: boolean;
  showResultsInfo?: boolean;
  pageSize?: number;
  onChange: (page: number, pageSize: number) => void;
  total: number;
  current?: number;
  adjustPagination?: boolean;
  paginationBorder?: boolean;
}

export default function Pagination(props: Props) {
  const {
    isDisabled,
    total,
    current = 1,
    pageSize = DEFAULT_PAGE_SIZE,
    showResultsInfo = true,
    onChange,
    adjustPagination = false,
    paginationBorder = false,
  } = props;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        ...(adjustPagination
          ? { width: 'calc(100% + 1rem)', marginLeft: '-0.5rem' }
          : { width: '100%' }),
        alignItems: 'center',
        backgroundColor: 'white',
        ...(paginationBorder ? { border: `1px solid ${COLORS.gray2}` } : {}),
      }}
    >
      <div className={s.root}>
        <AntPagination
          disabled={isDisabled}
          className={s.paginationRoot}
          showQuickJumper
          showSizeChanger={false}
          showTotal={
            showResultsInfo
              ? (total) => (
                  <span>
                    {showResultsInfo && pageSize && current && (
                      <>
                        Showing {pageSize * (current - 1) + 1} -{' '}
                        {Math.min(pageSize * current, total)} of {total} results
                      </>
                    )}
                  </span>
                )
              : undefined
          }
          total={total}
          pageSize={pageSize ?? DEFAULT_PAGE_SIZE}
          current={current}
          onChange={onChange}
        />
        <Select<number>
          mode="SINGLE"
          onChange={(value) => {
            onChange(1, value ?? DEFAULT_PAGE_SIZE);
          }}
          value={pageSize}
          options={PAGE_SIZE_OPTIONS.map((pageSize) => ({
            value: pageSize,
            label: `${pageSize} / page`,
          }))}
          dropdownPlacement="topRight"
        />
      </div>
    </div>
  );
}
