import React, { useState } from 'react';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';

export default function (): JSX.Element {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>();
  return (
    <>
      <UseCase title="Example">
        <Component
          showResultsInfo={true}
          total={1000}
          current={page}
          pageSize={pageSize}
          onChange={(page, pageSize) => {
            setPage(page);
            setPageSize(pageSize);
          }}
        />
      </UseCase>
      <UseCase title="Pagination with border">
        <Component
          showResultsInfo={true}
          total={1000}
          current={page}
          pageSize={pageSize}
          onChange={(page, pageSize) => {
            setPage(page);
            setPageSize(pageSize);
          }}
          paginationBorder={true}
        />
      </UseCase>
    </>
  );
}
