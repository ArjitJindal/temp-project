import React, { useMemo } from 'react';
import cn from 'clsx';
import pluralize from 'pluralize';
import s from './index.module.less';
import { formatNumber } from '@/utils/number';
import { DEFAULT_PAGE_SIZE } from '@/components/library/Table/consts';
import ArrowLeftSLineIcon from '@/components/ui/icons/Remix/system/arrow-left-s-line.react.svg';
import ArrowRightSLineIcon from '@/components/ui/icons/Remix/system/arrow-right-s-line.react.svg';
import SkipLeftLineIcon from '@/components/ui/icons/Remix/system/skip-left-line.react.svg';
import SkipRightLineIcon from '@/components/ui/icons/Remix/system/skip-right-line.react.svg';
import MoreLineIcon from '@/components/ui/icons/Remix/system/more-line.react.svg';
import Select from '@/components/library/Select';
import Label from '@/components/library/Label';
import { AsyncResource, getOr, isLoading } from '@/utils/asyncResource';
import { Cursor } from '@/utils/queries/types';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const COUNT_QUERY_LIMIT = 100000;

const MAX_BUTTONS_TO_SHOW = 7;
const MAX_SIDE_BUTTONS = Math.floor(MAX_BUTTONS_TO_SHOW / 2);

interface CursorProps {
  isDisabled?: boolean;
  pageSize?: number;
  onPageChange: (pageSize: number) => void;
  onFromChange: (from: string) => void;
  cursorRes: AsyncResource<Cursor>;
}

interface PageBasedProps {
  isDisabled?: boolean;
  showResultsInfo?: boolean;
  pageSize?: number;
  onChange: (page: number, pageSize: number) => void;
  total: number;
  current?: number;

  // Special props for table with dynamic number of items per page
  totalPages?: number;
  currentItems?: number;
}

type Props = CursorProps | PageBasedProps;

export default function Pagination(props: Props) {
  if ('cursorRes' in props) {
    return <CursorPagination {...props} />;
  }
  return <PageBasedPagination {...props} />;
}

function PageBasedPagination(props: PageBasedProps) {
  const {
    isDisabled,
    total,
    totalPages,
    current = 1,
    currentItems,
    pageSize = DEFAULT_PAGE_SIZE,
    showResultsInfo = true,
    onChange,
  } = props;

  const normalisedTotalPages = useMemo(() => {
    if (totalPages != null) {
      return totalPages;
    }
    return Math.max(1, Math.ceil(total / pageSize));
  }, [totalPages, total, pageSize]);

  const buttonsToShow = Math.min(normalisedTotalPages, MAX_BUTTONS_TO_SHOW);
  const buttonsOnLeft = Math.min(
    current - 1,
    buttonsToShow - 1 - Math.min(MAX_SIDE_BUTTONS, normalisedTotalPages - current),
  );
  const buttonsOnRight = buttonsToShow - 1 - buttonsOnLeft;
  const allPagesVisibleOnLeft = buttonsOnLeft >= current - 1;
  const allPagesVisibleOnRight = buttonsOnRight >= normalisedTotalPages - current;

  return (
    <nav className={s.root} data-cy="pagination" role="pagination">
      <div className={s.side}>
        {showResultsInfo && (
          <ResultsInfo
            current={current}
            currentItems={currentItems}
            pageSize={pageSize}
            total={total}
            totalPages={totalPages}
          />
        )}
        <div className={s.buttonsGroup}>
          <IconButton
            isDisabled={isDisabled || current <= 1}
            onClick={() => {
              onChange(current - 1, pageSize);
            }}
          >
            <ArrowLeftSLineIcon />
          </IconButton>
        </div>
        <div className={s.buttonsGroup}>
          {[...new Array(normalisedTotalPages)].map((_, i) => {
            const page = i + 1;
            if (!allPagesVisibleOnLeft || !allPagesVisibleOnRight) {
              if (page !== 1 && page !== normalisedTotalPages) {
                if (!allPagesVisibleOnLeft) {
                  if (page === 2) {
                    return (
                      <IconButton key={i} isDisabled={true}>
                        <MoreLineIcon />
                      </IconButton>
                    );
                  }
                  if (page < current - (buttonsOnLeft - 2)) {
                    return <React.Fragment key={i}></React.Fragment>;
                  }
                }
                if (!allPagesVisibleOnRight) {
                  if (page === current + buttonsOnRight) {
                    return (
                      <IconButton key={i} isDisabled={true}>
                        <MoreLineIcon />
                      </IconButton>
                    );
                  }
                  if (page - current + 2 > buttonsOnRight) {
                    return <React.Fragment key={i}></React.Fragment>;
                  }
                }
              }
            }
            return (
              <PageNumberButton
                key={i}
                page={page}
                isActive={page === current}
                isDisabled={isDisabled}
                onClick={() => onChange(page, pageSize)}
              />
            );
          })}
        </div>
        <div className={s.buttonsGroup}>
          <IconButton
            isDisabled={isDisabled || current >= normalisedTotalPages}
            onClick={() => {
              onChange(current + 1, pageSize);
            }}
          >
            <ArrowRightSLineIcon />
          </IconButton>
        </div>
      </div>
      {false && (
        <div className={s.buttonsGroup}>
          {[...new Array(current - 1)].map((_, i) => {
            if (!allPagesVisibleOnLeft && i !== 0 && current - i > MAX_SIDE_BUTTONS - 1) {
              return <></>;
            }
            const page = i + 1;
            return (
              <>
                <PageNumberButton
                  key={i}
                  page={page}
                  isDisabled={isDisabled}
                  onClick={() => onChange(page, pageSize)}
                />
                {!allPagesVisibleOnLeft && i === 0 && (
                  <IconButton isDisabled={isDisabled}>
                    <MoreLineIcon />
                  </IconButton>
                )}
              </>
            );
          })}
          <PageNumberButton page={current} isActive={true} isDisabled={isDisabled} />
          {[...new Array(normalisedTotalPages - current)].map((_, i) => {
            const page = current + i + 1;
            if (
              !allPagesVisibleOnRight &&
              i > MAX_SIDE_BUTTONS - 2 &&
              page !== normalisedTotalPages
            ) {
              return <></>;
            }
            return (
              <>
                {!allPagesVisibleOnRight && page === normalisedTotalPages && (
                  <IconButton isDisabled={isDisabled}>
                    <MoreLineIcon />
                  </IconButton>
                )}
                <PageNumberButton
                  key={i}
                  page={page}
                  isDisabled={isDisabled}
                  onClick={() => onChange(page, pageSize)}
                />
              </>
            );
          })}
        </div>
      )}
      <div className={cn(s.side, s.right)}>
        <div>
          <Label label={'Go to page'} level={2} position={'LEFT'}>
            <Select<number>
              isDisabled={isDisabled}
              mode="SINGLE"
              onChange={(value) => {
                onChange(value ?? 1, pageSize);
              }}
              value={current}
              options={[...new Array(normalisedTotalPages)].map((_, page) => ({
                value: page + 1,
                label: `${page + 1}`,
              }))}
              dropdownPlacement="topRight"
            />
          </Label>
        </div>
        {totalPages == null && (
          <div>
            <Label label={'Items per page'} level={2} position={'LEFT'}>
              <Select<number>
                isDisabled={isDisabled}
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
            </Label>
          </div>
        )}
      </div>
    </nav>
  );
}

function CursorPagination(props: CursorProps) {
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
    <nav className={s.root}>
      <div className={s.side}>
        {resultMessage}
        <IconButton
          onClick={() => {
            if (cursor) {
              onFromChange('');
            }
          }}
          isDisabled={isCursorLoading || !cursor?.hasPrev || isDisabled}
        >
          <SkipLeftLineIcon />
        </IconButton>
        <IconButton
          onClick={() => {
            onFromChange(cursor?.prev ?? '');
          }}
          isDisabled={isCursorLoading || !cursor?.hasPrev || isDisabled}
          testId="pagination-prev-button"
        >
          <ArrowLeftSLineIcon />
        </IconButton>
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
        <IconButton
          onClick={() => {
            if (cursor?.next) {
              onFromChange(cursor?.next);
            }
          }}
          isDisabled={isCursorLoading || !cursor?.hasNext || isDisabled}
          testId="pagination-next-button"
        >
          <ArrowRightSLineIcon />
        </IconButton>
        <IconButton
          onClick={() => {
            if (cursor?.last) {
              onFromChange(cursor.last);
            }
          }}
          isDisabled={isCursorLoading || !cursor?.hasNext || isDisabled}
        >
          <SkipRightLineIcon />
        </IconButton>
      </div>
    </nav>
  );
}

/*
  Utils
 */
function ResultsInfo(props: {
  current: number;
  pageSize: number;
  total: number;
  totalPages: number | undefined;
  currentItems: number | undefined;
}) {
  const { current = 1, pageSize = DEFAULT_PAGE_SIZE, total, currentItems, totalPages } = props;
  const currentPageCountInfo =
    totalPages && currentItems
      ? `${currentItems}`
      : `${formatNumber(pageSize * (current - 1) + 1)} - ${formatNumber(
          Math.min(pageSize * current, total),
        )}`;
  return (
    <div className={s.resultsInfo}>
      Showing <span>{currentPageCountInfo}</span> of {formatNumber(Number(total ?? 0))} items
      {total >= COUNT_QUERY_LIMIT ? '+' : ''}
    </div>
  );
}

function NavigationButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    isDisabled?: boolean;
    className?: string;
    children: React.ReactNode;
    onClick?: () => void;
    testId?: string;
  },
) {
  const { className, isDisabled, children, onClick, testId, ...rest } = props;
  return (
    <button
      {...rest}
      data-cy={testId}
      disabled={isDisabled}
      className={cn(s.navigationButton, className)}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function PageNumberButton(props: {
  page: number;
  isActive?: boolean;
  isDisabled?: boolean;
  onClick?: () => void;
}) {
  const { page, isDisabled, isActive, onClick } = props;
  return (
    <NavigationButton
      isDisabled={isDisabled}
      className={cn(s.numberButton, isActive && s.isActive)}
      onClick={onClick}
      testId={'pagination-page-number-button'}
      aria-current={isActive}
    >
      {page}
    </NavigationButton>
  );
}

function IconButton(props: {
  isDisabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  testId?: string;
}) {
  const { children, isDisabled, onClick, testId } = props;
  return (
    <NavigationButton
      isDisabled={isDisabled}
      className={cn(s.numberButton, s.iconButton)}
      onClick={onClick}
      testId={testId}
    >
      {children}
    </NavigationButton>
  );
}
