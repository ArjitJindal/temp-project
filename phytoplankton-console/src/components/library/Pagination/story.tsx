import React, { useState } from 'react';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';
import Slider from '@/components/library/Slider';
import Label from '@/components/library/Label';
import { success } from '@/utils/asyncResource';

export default function (): JSX.Element {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>();
  const [total, setTotal] = useState(1000);
  return (
    <>
      <Label label={'Total amount of items'}>
        <Slider
          min={0}
          max={10000}
          value={total}
          mode={'SINGLE'}
          onChange={(value) => {
            setTotal(value ?? 0);
          }}
        />
      </Label>
      <UseCase title="Example">
        <Component
          total={total}
          current={page}
          pageSize={pageSize}
          onChange={(page, pageSize) => {
            setPage(page);
            setPageSize(pageSize);
          }}
        />
      </UseCase>
      <UseCase title="Empty result">
        <Component
          total={0}
          current={page}
          pageSize={pageSize}
          onChange={(page, pageSize) => {
            setPage(page);
            setPageSize(pageSize);
          }}
        />
      </UseCase>
      <UseCase title="Hide results info">
        <Component
          showResultsInfo={false}
          total={total}
          current={page}
          pageSize={pageSize}
          onChange={(page, pageSize) => {
            setPage(page);
            setPageSize(pageSize);
          }}
        />
      </UseCase>
      <UseCase title="Disabled">
        <Component
          isDisabled={true}
          showResultsInfo={true}
          total={total}
          current={page}
          pageSize={pageSize}
          onChange={(page, pageSize) => {
            setPage(page);
            setPageSize(pageSize);
          }}
        />
      </UseCase>
      <UseCase title="Cursor pagination">
        <Component
          isDisabled={false}
          pageSize={pageSize}
          onPageChange={(pageSize) => {
            setPageSize(pageSize);
          }}
          onFromChange={() => {}}
          cursorRes={success({
            prev: undefined,
            next: undefined,
            last: undefined,
            hasNext: false,
            hasPrev: false,
            count: total,
            limit: pageSize,
          })}
          // isDisabled={true}
          // showResultsInfo={true}
          // total={total}
          // current={page}
          // pageSize={pageSize}
          // onChange={(page, pageSize) => {
          //   setPage(page);
          //   setPageSize(pageSize);
          // }}
        />
      </UseCase>
    </>
  );
}
