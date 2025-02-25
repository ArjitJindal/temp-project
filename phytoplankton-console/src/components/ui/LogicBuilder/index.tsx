import { Builder, BuilderProps, Query, Utils as QbUtils } from '@react-awesome-query-builder/ui';
import '@react-awesome-query-builder/ui/css/styles.css';
import React, { useEffect } from 'react';
import cn from 'clsx';
import { Operators } from '@react-awesome-query-builder/core';
import { noop } from 'lodash';
import s from './index.module.less';
import { LogicBuilderValue, QueryBuilderConfig } from './types';

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
}) as NonNullable<LogicBuilderValue>;

const renderBuilder = (props: BuilderProps) => (
  <div className="query-builder">
    <Builder {...props} />
  </div>
);

export interface Props {
  hideConjunctions?: boolean;
  operators?: Operators;
  config: QueryBuilderConfig;
  value?: LogicBuilderValue;
  onChange?: (newValue: LogicBuilderValue, config: QueryBuilderConfig) => void;
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

  const mode = config.settings.mode ?? 'EDIT';

  return (
    <div className={cn(s.root, hideConjunctions && s.hideConjunctions, s[`mode-${mode}`])}>
      <Query {...config} value={value} onChange={onChange ?? noop} renderBuilder={renderBuilder} />
    </div>
  );
}
