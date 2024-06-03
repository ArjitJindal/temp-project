import React, { MutableRefObject } from 'react';

export interface WidgetPropsRequired {
  id?: string;
}

export interface WidgetPropsOptional {
  title: string;
  width: 'FULL' | 'HALF';
  resizing?: 'AUTO' | 'FIXED';
  onDownload: () => Promise<{
    fileName: string;
    data?: string;
    pdfRef?: MutableRefObject<HTMLInputElement>;
  }>;
  downloadFilenamePrefix?: string;
  extraControls: React.ReactNode[];
  children: React.ReactNode;
}

export type WidgetProps = WidgetPropsRequired & Partial<WidgetPropsOptional>;
