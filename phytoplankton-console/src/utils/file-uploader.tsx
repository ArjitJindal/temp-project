import mime from 'mime';
import { ObjectDefaultApi as FlagrightApi } from '@/apis/types/ObjectParamAPI';

export async function uploadFile(api: FlagrightApi, file: File): Promise<{ s3Key: string }> {
  const filename = file.name ?? '';
  const fileSize = file.size;

  // 1. Get S3 presigned URL
  const { presignedUrl, s3Key } = await api.postGetPresignedUrl({ filename, fileSize });

  // 2. Upload file to S3 directly
  const headers: Record<string, string> = {
    'Content-Type': mime.getType(filename) ?? '',
    'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    'X-Content-Type-Options': 'nosniff',
  };
  const response = await fetch(presignedUrl, {
    method: 'PUT',
    headers: headers,
    body: file,
  });
  if (!response.ok) {
    console.error({
      status: response.status,
      statusText: response.statusText,
      body: await response.text(),
    });
    throw new Error(`Unable to upload file`);
  }

  return { s3Key };
}
