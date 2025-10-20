import { CSSProperties, useLayoutEffect, useMemo, useState } from 'react';
import cn from 'clsx';
import s from './index.module.less';
import { Comparable, compare, key } from '@/utils/comparable';
import { Option, TagRenderer } from '@/components/library/Select';
import { useElementSize } from '@/utils/browser';
import {
  DEFAULT_TAG_RENDERER,
  getOptionLabelNode,
  InternalOption,
} from '@/components/library/Select/helpers';

const HIDDEN_TAGS_INFO_PADDING = 50;

const DEFAULT_TAGS_SORTER = (a, b) => {
  const nodeA = getOptionLabelNode(a);
  const nodeB = getOptionLabelNode(b);
  const lenA = typeof nodeA === 'string' ? nodeA.length : 0;
  const lenB = typeof nodeB === 'string' ? nodeB.length : 0;
  return lenA - lenB;
};

export type TagsStackParams<Value extends Comparable> = {
  enabled: boolean;
  tagsOrder?: (a: Option<Value>, b: Option<Value>) => number;
  transparentBackground?: boolean;
};

type Props<Value extends Comparable> = {
  params: TagsStackParams<Value>;
  isDisabled: boolean;
  selectedOptions: InternalOption<Value>[];
  onRemove: (value: Value | string) => void;
  tagRenderer?: TagRenderer<Value>;
};

export default function TagsStack<Value extends Comparable>(props: Props<Value>) {
  const { isDisabled, params } = props;
  const [tagsStackContainerEl, setTagsStackContainerEl] = useState<HTMLDivElement | null>(null);
  const [tagsFit, setTagsFit] = useState(0);
  const [minWidth, setMinWidth] = useState(undefined);
  const tagsStackContainerSize = useElementSize(tagsStackContainerEl);
  const [hoverOption, setHoverOption] = useState<Value | null>(null);

  const fixedOptions = useMemo(() => {
    const result = [...props.selectedOptions];
    result.sort(params.tagsOrder ? params.tagsOrder : DEFAULT_TAGS_SORTER);
    return result;
  }, [props.selectedOptions, params.tagsOrder]);

  // Use current values string to detect if we need to recalculate tags fit
  const optionsSelected = useMemo(() => {
    return JSON.stringify(fixedOptions.map((x) => x.value));
  }, [fixedOptions]);

  useLayoutEffect(() => {
    if (tagsStackContainerEl != null && tagsStackContainerSize != null) {
      let minWidth;
      for (let i = 0; i < tagsStackContainerEl.children.length; i++) {
        const element = tagsStackContainerEl.children[i];
        if (element instanceof HTMLElement) {
          if (i === 0) {
            minWidth = element.offsetWidth;
          }
          const rightBorderPosition = element.offsetLeft + element.offsetWidth;
          const isOverflow =
            rightBorderPosition > tagsStackContainerSize?.width - HIDDEN_TAGS_INFO_PADDING;
          if (isOverflow) {
            setTagsFit(i);
            break;
          }
        }
        if (i === tagsStackContainerEl.childNodes.length - 1) {
          setTagsFit(tagsStackContainerEl.childNodes.length);
        }
      }
      setMinWidth(minWidth);
      setHoverOption(null);
    }
  }, [tagsStackContainerEl, tagsStackContainerSize, optionsSelected]);

  const tagsHidden = fixedOptions.length - tagsFit;

  const tagRenderer: TagRenderer<Value> = useMemo(() => {
    if (props.tagRenderer) {
      return props.tagRenderer;
    }
    return (props) => {
      return (
        <div
          className={cn(s.defaultTagWrapper, {
            [s.isHovered]: props.isHovered,
            [s.isShadowed]: props.isShadowed,
          })}
        >
          {DEFAULT_TAG_RENDERER(props)}
        </div>
      );
    };
  }, [props.tagRenderer]);

  return (
    <div
      className={cn(s.root, {
        [s.isDisabled]: props.isDisabled,
        [s.transparentBackground]: params.transparentBackground,
      })}
      style={{ minWidth: minWidth ? minWidth + HIDDEN_TAGS_INFO_PADDING : undefined }}
    >
      {tagsHidden > 0 && <div className={s.hiddenInfo}>+ {tagsHidden} more</div>}
      <div className={s.container} ref={setTagsStackContainerEl}>
        {fixedOptions.map((option, i) => {
          const style: CSSProperties = {
            visibility: i < tagsFit ? 'visible' : 'hidden',
          };
          style['--position'] = i;
          return (
            <div
              key={key(option.value)}
              className={s.tagWrapper}
              style={style}
              onMouseEnter={() => setHoverOption(option.value)}
              onMouseLeave={() => setHoverOption(null)}
            >
              {tagRenderer({
                option,
                onRemove: () => props.onRemove(option.value),
                isOnTop: i === tagsFit - 1,
                isHovered: hoverOption != null && compare(option.value, hoverOption),
                isShadowed: hoverOption != null && !compare(option.value, hoverOption),
                isDisabled: isDisabled || (option.isDisabled ?? false),
                isOptionFound: !(option.isNotFoundOption ?? false),
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
