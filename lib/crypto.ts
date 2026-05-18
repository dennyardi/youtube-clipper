import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey() {
  const source = process.env.APP_ENCRYPTION_KEY || process.env.AUTH_SESSION_SECRET || process.env.OPENAI_API_KEY;
  if (!source) {
    throw new Error("APP_ENCRYPTION_KEY belum diisi di .env.");
  }
  return crypto.createHash("sha256").update(source).digest();
}

export function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptSecret(payload?: string | null) {
  if (!payload) return null;
  const [ivText, tagText, encryptedText] = payload.split(".");
  if (!ivText || !tagText || !encryptedText) return null;

  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), Buffer.from(ivText, "base64"));
  decipher.setAuthTag(Buffer.from(tagText, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64")), decipher.final()]).toString("utf8");
}

export function maskSecret(value?: string | null) {
  if (!value) return null;
  if (value.length <= 10) return "********";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}
