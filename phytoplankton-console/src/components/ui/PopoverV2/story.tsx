import PopoverV2, { Placement, Trigger } from '.';
import { UseCase } from '@/pages/storybook/components';
import PropertyMatrix from '@/pages/storybook/components/PropertyMatrix';
import Toggle from '@/components/library/Toggle';
import Label from '@/components/library/Label';

function PopoverContent(props: { large?: boolean }) {
  return (
    <div>
      Popover content. We need to make it large enough to test behaviour when popover doesn't fit
      into the screen. This includes verifying that the component correctly repositions itself,
      applies fallback placement logic, and avoids being clipped by the viewport boundaries.
      Additionally, we should ensure that scroll behavior, z-index layering, and accessibility
      attributes remain intact under constrained layout conditions.
      {props.large && (
        <>
          <br />
          <br />
          To simulate a real-world scenario, the content can contain multiple paragraphs,
          interactive elements like buttons or inputs, and even embedded media. The goal is to
          validate not only visual overflow handling but also user interaction when part of the
          popover is initially rendered off-screen.
          <br />
          <br />
          It's also important to evaluate how the popover behaves across different screen sizes and
          device orientations. Responsive adjustments, such as dynamic resizing or adaptive
          placement, should be thoroughly tested. Furthermore, developers should account for
          potential layout shifts caused by virtual keyboards on mobile devices, ensuring that the
          popover remains accessible and does not obstruct critical interface elements during user
          input.
          <br />
          <br />
          Another critical aspect is testing how the popover handles content updates while it is
          visible. For instance, if asynchronous data loads into the popover or if user interactions
          dynamically change its size, the positioning engine must react accordingly to prevent
          visual glitches or overlap with surrounding UI components. This includes recalculating
          placement, maintaining focus for accessibility, and avoiding sudden jumps that could
          disrupt the user experience.
        </>
      )}
    </div>
  );
}

export default function () {
  return (
    <>
      <UseCase title={'Basic use case'}>
        <PopoverV2 content={<PopoverContent />}>
          <div style={{ background: '#ffffa0' }}>Trigger</div>
        </PopoverV2>
      </UseCase>
      <UseCase title={'Trigger click'}>
        <PopoverV2 content={<PopoverContent />} trigger={'click'}>
          <div style={{ background: '#ffffa0' }}>Trigger</div>
        </PopoverV2>
      </UseCase>

      <UseCase title={'Positions and triggers'} initialState={{ largePopover: false }}>
        {([state, setState]) => (
          <>
            <Label label={'Large popover'} position={'RIGHT'}>
              <Toggle
                size={'S'}
                value={state.largePopover}
                onChange={(newValue) =>
                  setState((prev) => ({
                    ...prev,
                    largePopover: newValue,
                  }))
                }
              />
            </Label>
            <PropertyMatrix<Placement, Trigger>
              xLabel="placement"
              yLabel="trigger"
              x={['top-start', 'top', 'top-end', 'bottom-start', 'bottom', 'bottom-end']}
              y={['hover', 'click']}
            >
              {(x, y) => (
                <PopoverV2
                  content={<PopoverContent large={state.largePopover} />}
                  placement={x}
                  trigger={y}
                >
                  <div style={{ background: '#ffffa0' }}>Trigger</div>
                </PopoverV2>
              )}
            </PropertyMatrix>
          </>
        )}
      </UseCase>

      <div
        style={{
          height: '500px',
          border: '1px dashed rgb(213 206 162)',
          background: 'rgb(255 245 0 / 12%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgb(213 206 162)',
          fontSize: '1.5em',
        }}
      >
        Placeholder to test page scrolling
      </div>
    </>
  );
}
