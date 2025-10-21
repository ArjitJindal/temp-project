import React, { Children } from 'react';
import s from './index.module.less';
import Tag, { TagColor } from '@/components/library/Tag';
import Tooltip from '@/components/library/Tooltip';

function ValueTag(props: {
  color?: TagColor;
  children: React.ReactNode | undefined | null;
  fullTextForTooltip?: string | null;
}) {
  const children = props.children ?? 'N/A';

  // Extract text content properly, handling React elements and objects
  const getTextContent = (node: React.ReactNode): string => {
    if (typeof node === 'string' || typeof node === 'number') {
      return String(node);
    }
    if (React.isValidElement(node)) {
      if (typeof node.props.children === 'string' || typeof node.props.children === 'number') {
        return String(node.props.children);
      }
      if (Array.isArray(node.props.children)) {
        return node.props.children.map(getTextContent).join('');
      }
      return getTextContent(node.props.children);
    }
    if (Array.isArray(node)) {
      return node.map(getTextContent).join('');
    }
    return String(node);
  };

  // Clean up the text content to remove unwanted prefixes/suffixes
  const cleanTextContent = (text: string): string => {
    // Remove common unwanted prefixes and suffixes
    const cleaned = text
      .replace(/^false/, '')
      .replace(/^true/, '')
      .replace(/\s+amount$/, '')
      .replace(/\s+count$/, '')
      .trim();

    return cleaned;
  };

  const textContent = getTextContent(children);
  const cleanedTextContent = cleanTextContent(textContent);

  // Use fullTextForTooltip if available, otherwise use cleaned text
  const tooltipText = props.fullTextForTooltip || cleanedTextContent;

  return (
    <Tooltip title={tooltipText} placement="top">
      <Tag color={props.color} trimText={false} disableWrapText={false}>
        {children}
      </Tag>
    </Tooltip>
  );
}

export default function ViewModeTags(props: {
  color?: TagColor;
  children: React.ReactNode | React.ReactNode[] | undefined | null | false;
  fullTextForTooltip?: string | null;
}) {
  const flattenedChildren = Children.toArray(props.children).filter((x) => x === 0 || !!x);

  return (
    <div className={s.root}>
      <ValueTag color={props.color} fullTextForTooltip={props.fullTextForTooltip}>
        {flattenedChildren.map((node, i) => (
          <React.Fragment key={i}>
            {i !== 0 && ', '}
            {node}
          </React.Fragment>
        ))}
      </ValueTag>
    </div>
  );
}
