import React from 'react';
import { Pagination as AntPagination } from 'antd';
import s from './index.module.less';
import { DEFAULT_PAGE_SIZE } from '@/components/library/Table/consts';
import Select from '@/components/library/Select';
import COLORS from '@/components/ui/colors';
import { formatNumber } from '@/utils/number';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const COUNT_QUERY_LIMIT = 100000;

interface Props {
  isDisabled?: boolean;
  showResultsInfo?: boolean;
  pageSize?: number;
  onChange: (page: number, pageSize: number) => void;
  total: number;
  current?: number;

  // Special props for table with dynamic number of items per page
  totalPages?: number;
  currentItems?: number;

  adjustPagination?: boolean;
  paginationBorder?: boolean;
}

export default function Pagination(props: Props) {
  const {
    isDisabled,
    total,
    totalPages,
    current = 1,
    currentItems,
    pageSize = DEFAULT_PAGE_SIZE,
    showResultsInfo = true,
    onChange,
    adjustPagination = false,
    paginationBorder = false,
  } = props;

  return (
    <div
      role="pagination"
      data-cy="pagination"
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
              ? () => {
                  const currentPageCountInfo =
                    totalPages && currentItems
                      ? `${currentItems}`
                      : `${formatNumber(pageSize * (current - 1) + 1)} - ${formatNumber(
                          Math.min(pageSize * current, total),
                        )}`;
                  return (
                    <span>
                      {showResultsInfo && pageSize && current && (
                        <>
                          Showing {currentPageCountInfo} of {formatNumber(Number(total ?? 0))}
                          {total >= COUNT_QUERY_LIMIT ? '+' : ''}
                        </>
                      )}
                    </span>
                  );
                }
              : undefined
          }
          total={totalPages ? totalPages * pageSize : total}
          pageSize={pageSize}
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
