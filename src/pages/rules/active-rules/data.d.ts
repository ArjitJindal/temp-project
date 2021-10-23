import { RuleAction, ThresholdDataType, RuleTableListItem } from '../data.d';

export const valueEnum = {
  0: 'close',
  1: 'running',
  2: 'online',
  3: 'error',
};

export const ProcessMap = {
  close: 'normal',
  running: 'active',
  online: 'success',
  error: 'exception',
};
