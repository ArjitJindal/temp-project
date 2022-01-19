// eslint-disable-next-line import/no-extraneous-dependencies
import type { Request, Response } from 'express';
import { CreateListsTableListItem } from './data.d';

export const createTableList = () => {
  const tableListDataSource: CreateListsTableListItem[] = [];

  for (let i = 0; i < 5; i += 1) {
    tableListDataSource.push({
      listId: `L-${i}`,
      ibanNumber: `LT${Math.floor(Math.random() * 1000000000)}`,
      createdAt: Date.now() - Math.floor(Math.random() * 100000),
    });
  }
  return tableListDataSource;
};

function getActiveLists(req: Request, res: Response) {
  const result = {
    data: createTableList(),
  };
  return res.json(result);
}

export default {
  'GET  /api/lists/created-lists': getActiveLists,
};
