import type { Request, Response } from 'express';

// TODO: Use real data in https://flagright.atlassian.net/browse/FDT-86
export default {
  'GET /api/files': (req: Request, res: Response) => {
    return res.json({
      data: [
        {
          id: '1',
          filename: 'test1.csv',
          importedTransactions: 100,
          totalTransactions: 100,
          failedTransactions: 0,
          createdAt: new Date(),
          status: 'IMPORTED',
        },
        {
          id: '2',
          filename: 'test2.csv',
          importedTransactions: 100,
          totalTransactions: 100,
          failedTransactions: 0,
          createdAt: new Date(),
          status: 'FAILED',
        },
        {
          id: '3',
          filename: 'test3.csv',
          importedTransactions: 100,
          totalTransactions: 100,
          failedTransactions: 0,
          createdAt: new Date(),
          status: 'IN_PROGRESS',
        },
      ],
      total: 1,
      success: true,
      pageSize: 1,
      current: 1,
    });
  },
};
