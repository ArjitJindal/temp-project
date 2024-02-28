import {
  Query,
  Builder,
  BuilderProps,
  Config,
  Utils as QbUtils,
} from '@react-awesome-query-builder/ui';
import '@react-awesome-query-builder/ui/css/styles.css';
import React, { useEffect } from 'react';
import cn from 'clsx';
import { Operators } from '@react-awesome-query-builder/core';
import s from './index.module.less';
import { LogicBuilderValue } from './types';

const guid1 = QbUtils.uuid();
const guid2 = QbUtils.uuid();
const EMPTY_VALUE = QbUtils.jsToImmutable({
  type: 'group',
  id: guid1,
  children1: {
    [guid2]: {
      type: 'rule',
      id: guid2,
      properties: {
        fieldSrc: 'field',
      },
      path: [guid1, guid2],
    },
  },
  properties: {
    conjunction: 'AND',
    not: false,
  },
  path: [guid1],
});

const renderBuilder = (props: BuilderProps) => (
  <div className="query-builder">
    <Builder {...props} />
  </div>
);

export interface Props {
  hideConjunctions?: boolean;
  operators?: Operators;
  config: Config;
  value?: LogicBuilderValue;
  onChange?: (newValue: LogicBuilderValue, config: Config) => void;
}

export default function LogicBuilder(props: Props) {
  const { value = EMPTY_VALUE, onChange, config, hideConjunctions = false } = props;

  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

  return (
    <div className={cn(s.root, hideConjunctions && s.hideConjunctions)}>
      <Query {...config} value={value} onChange={onChange} renderBuilder={renderBuilder} />
    </div>
  );
}
