import React, { useMemo } from 'react';
import cn from 'clsx';
import pluralize from 'pluralize';
import NumberInput from '../NumberInput';
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

const MAX_SIDE_BUTTONS = 5;
const MAX_BUTTONS_TO_SHOW = MAX_SIDE_BUTTONS * 2 + 1;

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
    currentItems,
    pageSize = DEFAULT_PAGE_SIZE,
    showResultsInfo = true,
    onChange,
  } = props;

  const normalisedTotalPages = useMemo(() => {
    if (totalPages != null) {
      return Math.max(1, totalPages);
    }
    return Math.max(1, Math.ceil(total / pageSize));
  }, [totalPages, total, pageSize]);

  const current = Math.min(Math.max(1, props.current ?? 1), normalisedTotalPages);

  let buttonsToShow: number;
  let buttonsOnLeft: number;
  let buttonsOnRight: number;
  let allPagesVisibleOnLeft: boolean;
  let allPagesVisibleOnRight: boolean;

  const allPagesVisible = normalisedTotalPages <= MAX_BUTTONS_TO_SHOW;
  if (allPagesVisible) {
    buttonsToShow = normalisedTotalPages;
    buttonsOnLeft = current - 1;
    buttonsOnRight = buttonsToShow - 1 - buttonsOnLeft;
    allPagesVisibleOnLeft = true;
    allPagesVisibleOnRight = true;
  } else {
    buttonsToShow = MAX_BUTTONS_TO_SHOW;
    if (current <= MAX_SIDE_BUTTONS + 1) {
      buttonsOnLeft = current - 1;
      buttonsOnRight = buttonsToShow - 1 - buttonsOnLeft;
      allPagesVisibleOnLeft = true;
      allPagesVisibleOnRight = false;
    } else if (current >= normalisedTotalPages - MAX_SIDE_BUTTONS) {
      buttonsOnLeft = buttonsToShow - 1 - (normalisedTotalPages - current);
      buttonsOnRight = normalisedTotalPages - current;
      allPagesVisibleOnLeft = false;
      allPagesVisibleOnRight = true;
    } else {
      buttonsOnLeft = MAX_SIDE_BUTTONS;
      buttonsOnRight = MAX_SIDE_BUTTONS;
      allPagesVisibleOnLeft = false;
      allPagesVisibleOnRight = false;
    }
  }

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
        {[...new Array(buttonsOnLeft)].map((_, i) => {
          if (allPagesVisibleOnLeft || i === 0) {
            const page = i + 1;
            return (
              <PageNumberButton key={page} page={page} onClick={() => onChange(page, pageSize)} />
            );
          }
          if (i === 1) {
            return (
              <IconButton key={'separator-left'} isDisabled={true}>
                <MoreLineIcon />
              </IconButton>
            );
          }
          const page = current - (buttonsOnLeft - i);
          return (
            <PageNumberButton key={page} page={page} onClick={() => onChange(page, pageSize)} />
          );
        })}
        <PageNumberButton page={current} isActive={true} />
        {[...new Array(buttonsOnRight)].map((_, i) => {
          if (!allPagesVisibleOnRight) {
            if (i === buttonsOnRight - 2) {
              return (
                <IconButton key={'separator-right'} isDisabled={true}>
                  <MoreLineIcon />
                </IconButton>
              );
            }
            if (i === buttonsOnRight - 1) {
              const page = normalisedTotalPages;
              return (
                <PageNumberButton key={page} page={page} onClick={() => onChange(page, pageSize)} />
              );
            }
          }
          const page = current + i + 1;
          return (
            <PageNumberButton key={page} page={page} onClick={() => onChange(page, pageSize)} />
          );
        })}
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
      <div className={cn(s.side, s.right)}>
        <div>
          <Label label={'Go to page'} level={2} position={'LEFT'}>
            <div className={s.goToPageInput}>
              <NumberInput
                isDisabled={isDisabled}
                min={1}
                max={normalisedTotalPages}
                onChange={(value) => {
                  if (value != null) {
                    onChange(Math.max(1, Math.min(normalisedTotalPages, value)), pageSize);
                  }
                }}
                value={current}
                commitMode="ON_BLUR"
              />
            </div>
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
