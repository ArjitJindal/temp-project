import axios from 'axios';
import mime from 'mime';
import { ObjectDefaultApi as FlagrightApi } from '@/apis/types/ObjectParamAPI';

export async function uploadFile(api: FlagrightApi, file: File): Promise<{ s3Key: string }> {
  const filename = file.name ?? '';
  const fileSize = file.size;

  // 1. Get S3 presigned URL
  const { presignedUrl, s3Key } = await api.postGetPresignedUrl({ filename, fileSize });

  // 2. Upload file to S3 directly
  await axios.put(presignedUrl, file, {
    headers: {
      'Content-Type': mime.getType(filename) ?? false,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
  return { s3Key };
}
