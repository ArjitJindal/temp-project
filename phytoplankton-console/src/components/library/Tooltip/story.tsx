import TextInput from '../TextInput';
import Component, { Placement, Trigger } from './index';
import { UseCase } from '@/pages/storybook/components';
import PropertyMatrix from '@/pages/storybook/components/PropertyMatrix';
import Select from '@/components/library/Select';
import Label from '@/components/library/Label';

const targetDivStyle = {
  border: '1px solid green',
  background: '#EFE',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export default function (): JSX.Element {
  return (
    <>
      <UseCase title={'Positions and triggers'}>
        <PropertyMatrix<Placement, Trigger>
          xLabel="placement"
          yLabel="trigger"
          x={['topLeft', 'top', 'topRight', 'bottomLeft', 'bottom', 'bottomRight']}
          y={['hover', 'click']}
        >
          {(x, y) => (
            <div style={{ display: 'block' }}>
              <Component
                title="You can simulate a maximum of 3 iterations for this rule at once."
                placement={x}
                trigger={y}
              >
                <div style={targetDivStyle}>{x}</div>
              </Component>
            </div>
          )}
        </PropertyMatrix>
      </UseCase>
      <UseCase
        title={'Experiments'}
        initialState={{
          position: 'top',
          trigger: 'hover',
          tooltip:
            'Sample tooltip text to demonstrate how it works. It should be long enough to wrap to the next line.',
        }}
      >
        {([state, setState]) => (
          <>
            <div style={{ display: 'flex', gap: 10 }}>
              <Label label="Placement">
                <Select
                  options={[
                    { label: 'top', value: 'top' },
                    { label: 'bottom', value: 'bottom' },
                    { label: 'left', value: 'left' },
                    { label: 'right', value: 'right' },
                    { label: 'topRight', value: 'topRight' },
                    { label: 'bottomRight', value: 'bottomRight' },
                    { label: 'bottomLeft', value: 'bottomLeft' },
                    { label: 'topLeft', value: 'topLeft' },
                  ]}
                  value={state.position}
                  onChange={(value) => setState({ ...state, position: value })}
                />
              </Label>
              <Label label="Trigger">
                <Select
                  options={[
                    { label: 'hover', value: 'hover' },
                    { label: 'click', value: 'click' },
                  ]}
                  value={state.trigger}
                  onChange={(value) => setState({ ...state, trigger: value })}
                />
              </Label>
            </div>
            <Label label="Tooltip">
              <TextInput
                value={state.tooltip}
                onChange={(value) => setState({ ...state, tooltip: value })}
              />
            </Label>
            <div style={{ display: 'flex', gap: 10 }}>
              <Label label="Large target">
                <Component title={state.tooltip} placement={state.position} trigger={state.trigger}>
                  {({ style, ...props }) => (
                    <div
                      style={{ ...style, ...targetDivStyle, width: '100px', height: '100px' }}
                      {...props}
                    >
                      Large target
                    </div>
                  )}
                </Component>
              </Label>
              <Label label="Small target">
                <Component title={state.tooltip} placement={state.position} trigger={state.trigger}>
                  {({ style, ...props }) => (
                    <div
                      style={{ ...style, ...targetDivStyle, width: '10px', height: '10px' }}
                      {...props}
                    ></div>
                  )}
                </Component>
              </Label>
              <Label label="Inside scrollable container">
                <div
                  style={{
                    overflow: 'scroll',
                    height: '300px',
                    width: '300px',
                    backgroundColor: '#AFA',
                  }}
                >
                  <div
                    style={{
                      height: '2000px',
                      width: '2000px',
                      position: 'relative',
                      left: '150px',
                      top: '150px',
                    }}
                  >
                    <Component
                      title={state.tooltip}
                      placement={state.position}
                      trigger={state.trigger}
                    >
                      {({ style, ...props }) => (
                        <div
                          style={{ ...style, ...targetDivStyle, width: '50px', height: '50px' }}
                          {...props}
                        >
                          Target
                        </div>
                      )}
                    </Component>
                  </div>
                </div>
              </Label>
            </div>
          </>
        )}
      </UseCase>
      <UseCase title={'Custom arrow color and overlay'}>
        <Component
          title="You can simulate a maximum of 3 iterations for this rule at once."
          arrowColor="white"
          placement="top"
          trigger="click"
          overlay={
            <div
              style={{
                backgroundColor: 'white',
                padding: 10,
                boxShadow: '1px 1px 9px 2px #b6b6b6',
                borderRadius: 4,
              }}
            >
              Overlay
            </div>
          }
        >
          {({ style, ...props }) => (
            <div
              style={{ ...style, ...targetDivStyle, width: '100px', height: '100px' }}
              {...props}
            >
              Target
            </div>
          )}
        </Component>
      </UseCase>
    </>
  );
}
