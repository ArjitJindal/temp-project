import React from 'react';
import { describe, expect } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from 'testing-library-wrapper';
import JSZip from 'jszip';
import DownloadFilesButton, { createZipFile } from '..';

describe('DownloadFilesButton', () => {
  it('renders without crashing', () => {
    render(<DownloadFilesButton files={[]} />);
  });

  it('does not display button when no files are provided', () => {
    const { queryByTestId } = render(<DownloadFilesButton files={[]} />);
    const downloadButton = queryByTestId('download-all-button');
    expect(downloadButton).toBeNull();
  });

  it('displays button when files are provided', () => {
    const files = [{ filename: 'file1.txt', downloadLink: 'http://example.com/file1' }];
    const { getByTestId } = render(<DownloadFilesButton files={files as any} />);
    const downloadButton = getByTestId('download-all-button');
    expect(downloadButton).toBeInTheDocument();
  });

  it('displays loading message and handles download error', async () => {
    const files = [{ filename: 'file1.txt', downloadLink: 'http://example.com/file1' }];
    const { getByTestId } = render(<DownloadFilesButton files={files as any} />);
    const downloadButton = getByTestId('download-all-button');
    global.fetch = jest.fn().mockImplementation(() => Promise.reject(new Error('Download error')));

    fireEvent.click(downloadButton);
    await waitFor(() => {
      expect(screen.getByText('Downloading attachments')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Unable to complete the download')).toBeInTheDocument();
    });
  });

  it('downloads files when button is clicked', async () => {
    const files = [
      { filename: 'file1.txt', downloadLink: 'http://example.com/file1' },
      { filename: 'file2.txt', downloadLink: 'http://example.com/file2' },
    ];
    const { getByTestId } = render(<DownloadFilesButton files={files as any} />);
    const downloadButton = getByTestId('download-all-button');
    const originalFetch = global.fetch;

    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        blob: () => Promise.resolve(new Blob(['file content'], { type: 'text/plain' })),
      }),
    );

    fireEvent.click(downloadButton);

    await waitFor(() => {
      expect(screen.getByText('Downloading attachments')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    global.fetch = originalFetch;
  });

  it('creates a ZIP file with the correct content and structure', async () => {
    const files = [
      { filename: 'file1.txt', downloadLink: 'http://example.com/file1' },
      { filename: 'file2.txt', downloadLink: 'http://example.com/file2' },
    ];

    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        blob: () => Promise.resolve(new Blob(['file content'], { type: 'text/plain' })),
      }),
    );

    const zipBlob = await createZipFile(files as any);

    const zip = await JSZip.loadAsync(zipBlob);
    expect(zip.file('file1.txt')).toBeTruthy();
    expect(zip.file('file2.txt')).toBeTruthy();

    const content1 = await zip.file('file1.txt')?.async('text');
    const content2 = await zip.file('file2.txt')?.async('text');

    expect(content1).toBe('file content');
    expect(content2).toBe('file content');
  });
});
