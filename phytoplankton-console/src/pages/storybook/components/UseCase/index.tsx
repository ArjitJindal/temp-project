import React, { useState } from 'react';
import cn from 'clsx';
import s from './index.module.less';
import { StatePair } from '@/utils/state';

interface Props {
  title: string;
  description?: string;
  initialState?: Record<string, any>;
  children: React.ReactNode | ((state: StatePair<Record<string, any>>) => React.ReactNode);
}

export default function UseCase(props: Props) {
  const { children, title, description, initialState } = props;
  const state = useState<Record<string, any>>(initialState ?? {});
  const [bgColor, setBgColor] = useState('transparent');
  const [fullWidth, setFullWidth] = useState(false);
  const [stretchMode, setStretchMode] = useState(true);
  const [showState, setShowState] = useState(false);
  return (
    <div
      className={s.root}
      style={{
        maxWidth: fullWidth ? 'unset' : undefined,
      }}
    >
      <div className={s.header}>
        <div className={s.title}>{title}</div>
        <div className={s.headerButtons}>
          <StretchMode value={stretchMode} onChange={setStretchMode} />
          <FullWidth value={fullWidth} onChange={setFullWidth} />
          <ChangeColor value={bgColor} onChange={setBgColor} />
          {typeof children === 'function' && (
            <ShowState value={showState} onChange={setShowState} />
          )}
        </div>
      </div>
      <div className={s.content} style={{ background: bgColor }}>
        <div
          className={s.children}
          style={{
            alignItems: stretchMode ? 'unset' : 'start',
          }}
        >
          {typeof children === 'function' ? children(state) : children}
        </div>
      </div>
      {showState && (
        <div className={s.internals}>
          <pre>{JSON.stringify(state[0], null, 2)}</pre>
        </div>
      )}
      {description && <div className={s.description}>{description}</div>}
    </div>
  );
}

function ChangeColor(props: { value: string; onChange: (newValue: string) => void }) {
  const options = [
    'transparent',
    '#F5F5F5',
    'linear-gradient(180deg,#3623c6 0%,#5c0dc1 37.23%,#130666 82.38%)',
  ];
  const index = options.indexOf(props.value);
  return (
    <div
      title="Change background color"
      className={cn(s.button, s.changeColor)}
      style={{ background: props.value }}
      onClick={() => {
        props.onChange(options[(index + 1) % options.length]);
      }}
    ></div>
  );
}

function FullWidth(props: { value: boolean; onChange: (newValue: boolean) => void }) {
  return (
    <div
      title="Enable full width"
      className={cn(s.button, s.fullWidth, props.value && s.isEnabled)}
      style={{}}
      onClick={() => {
        props.onChange(!props.value);
      }}
    >
      W
    </div>
  );
}

function StretchMode(props: { value: boolean; onChange: (newValue: boolean) => void }) {
  return (
    <div
      title="Change stretch mode"
      className={cn(s.button, s.fullWidth, props.value && s.isEnabled)}
      style={{}}
      onClick={() => {
        props.onChange(!props.value);
      }}
    >
      S
    </div>
  );
}

function ShowState(props: { value: boolean; onChange: (newValue: boolean) => void }) {
  return (
    <div
      title="Show use case state"
      className={cn(s.button, s.fullWidth, props.value && s.isEnabled)}
      style={{}}
      onClick={() => {
        props.onChange(!props.value);
      }}
    >
      I
    </div>
  );
}
