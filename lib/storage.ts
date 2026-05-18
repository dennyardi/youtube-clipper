import fs from "node:fs";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function storageEnabled() {
  return Boolean(process.env.S3_ENDPOINT && process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
}

function s3Client() {
  if (!storageEnabled()) return null;

  return new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || "auto",
    forcePathStyle: String(process.env.S3_FORCE_PATH_STYLE || "true") === "true",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    },
  });
}

export function isObjectStorageEnabled() {
  return storageEnabled();
}

export async function uploadDownloadToStorage(filePath: string, jobId: string) {
  const client = s3Client();
  const bucket = process.env.S3_BUCKET;
  if (!client || !bucket) return null;

  const key = `downloads/${new Date().toISOString().slice(0, 10)}/${jobId}.mp4`;
  const body = fs.createReadStream(filePath);

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "video/mp4",
      Metadata: {
        source: "youtube-clipper-maker",
      },
    }),
  );

  return {
    storageKey: key,
    storageBucket: bucket,
    storageProvider: "s3",
  };
}

export async function createSignedDownloadUrl(storageKey: string) {
  const client = s3Client();
  const bucket = process.env.S3_BUCKET;
  if (!client || !bucket) throw new Error("Object storage belum dikonfigurasi.");

  const expiresIn = Math.max(60, Number(process.env.S3_SIGNED_URL_EXPIRES_SECONDS || 900));
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      ResponseContentDisposition: `attachment; filename="${path.basename(storageKey)}"`,
    }),
    { expiresIn },
  );
}

export async function deleteStorageObject(storageKey?: string | null) {
  const client = s3Client();
  const bucket = process.env.S3_BUCKET;
  if (!client || !bucket || !storageKey) return false;

  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }));
  return true;
}
