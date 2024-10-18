import { describe, expect } from '@jest/globals';
import { casesCommentsGenerator, commentsToString } from '../case-utils';
import { Account, Alert, Comment, FileInfo } from '@/apis';
import { dayjs } from '@/utils/dayjs';

const file: FileInfo = {
  filename: 'file1',
  s3Key: 's3Key1',
  size: 100,
};

const testUsers: { [key: string]: Account } = {
  user1: {
    blocked: false,
    email: 'user1@email.com',
    emailVerified: true,
    id: 'user1',
    name: 'user1',
    role: 'analyst',
  },
};

const testComment: Comment = {
  body: 'comment 1',
  createdAt: dayjs('2021-01-01T00:00:00.000Z').valueOf(),
  files: [file],
  userId: 'user1',
};

const testAlert: Alert = {
  createdTimestamp: dayjs('2021-01-01T00:00:00.000Z').valueOf(),
  numberOfTransactionsHit: 1,
  priority: 'P1',
  ruleAction: 'BLOCK',
  ruleDescription: 'rule 1',
  ruleId: 'rule1',
  ruleInstanceId: 'ruleInstanceId1',
  ruleName: 'ruleName1',
  comments: [testComment, testComment],
  alertId: 'alertId1',
};

describe('comments formatting', () => {
  test('format comments', () => {
    const data = commentsToString([testComment], testUsers);

    expect(data).toEqual(
      'comment 1\n\nAdded on: 12:00:00 AM Added by: user1\n\n1 attachment(s) added',
    );
  });

  test('format comments for cases', () => {
    const data = casesCommentsGenerator([testComment], [testAlert, testAlert], testUsers);
    expect(data).toEqual(
      `Other comments :\n\ncomment 1\n\nAdded on: 12:00:00 AM Added by: user1\n\n1 attachment(s) added\n\n\n\nAlert alertId1\n\ncomment 1\n\nAdded on: 12:00:00 AM Added by: user1\n\n1 attachment(s) added\n\n\ncomment 1\n\nAdded on: 12:00:00 AM Added by: user1\n\n1 attachment(s) added\n\n\n\nAlert alertId1\n\ncomment 1\n\nAdded on: 12:00:00 AM Added by: user1\n\n1 attachment(s) added\n\n\ncomment 1\n\nAdded on: 12:00:00 AM Added by: user1\n\n1 attachment(s) added`,
    );
  });
});
