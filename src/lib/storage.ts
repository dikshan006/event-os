import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { UserError } from "./errors";

/**
 * Object storage behind one small interface.
 *
 * Two drivers ship:
 *  - `s3`    — any S3-compatible endpoint. Cloudflare R2, AWS S3, Backblaze B2
 *              and MinIO all work by changing env vars only; no code branches
 *              on the vendor.
 *  - `local` — writes under `public/uploads` and is selected automatically when
 *              no bucket credentials are present. Same contract as the Stripe
 *              and Resend dev fallbacks already in this codebase: the whole app
 *              stays runnable on a laptop with an empty .env.
 *
 * Everything above this module (the image pipeline, the photo service, the
 * rendering components) only ever sees storage *keys* and public URLs, so
 * switching providers — or adding a CDN in front — never touches them.
 */

export type StoredObject = { key: string; bytes: number };

export interface StorageDriver {
  readonly name: "s3" | "local";
  put(key: string, body: Buffer, contentType: string): Promise<StoredObject>;
  /** Delete every object under a prefix. Must be safe to call twice. */
  deletePrefix(prefix: string): Promise<void>;
  /** Browser-resolvable URL for a stored key. */
  publicUrl(key: string): string;
}

const {
  S3_BUCKET,
  S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY,
  S3_ENDPOINT,
  S3_REGION,
  S3_PUBLIC_URL,
} = process.env;

export const storageEnabled = Boolean(S3_BUCKET && S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY);

/* ------------------------------------------------------------------ S3 ---- */

function s3Driver(): StorageDriver {
  const client = new S3Client({
    // R2 ignores region but the SDK requires one; "auto" is R2's convention.
    region: S3_REGION || "auto",
    endpoint: S3_ENDPOINT || undefined, // omitted → real AWS S3
    forcePathStyle: Boolean(S3_ENDPOINT), // MinIO and friends need path style
    credentials: {
      accessKeyId: S3_ACCESS_KEY_ID as string,
      secretAccessKey: S3_SECRET_ACCESS_KEY as string,
    },
  });

  // Derivatives are content-addressed by a uuid path segment and never mutated
  // in place, so they are safe to cache permanently at the edge.
  const IMMUTABLE = "public, max-age=31536000, immutable";

  return {
    name: "s3",
    async put(key, body, contentType) {
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: key,
            Body: body,
            ContentType: contentType,
            CacheControl: IMMUTABLE,
          }),
        );
      } catch (err) {
        // Bucket rejections are configuration problems, not bugs, and the SDK's
        // error name says exactly which one — InvalidAccessKeyId,
        // SignatureDoesNotMatch, NoSuchBucket, AccessDenied. Surfacing it turns
        // a dead end into a one-line fix.
        const name = err instanceof Error ? err.name : "UnknownError";
        console.error(`[storage] PutObject failed key=${key} bucket=${S3_BUCKET}`, err);
        throw new UserError(
          `Storage rejected the upload (${name}). Check S3_BUCKET, S3_ENDPOINT, S3_REGION and the access key.`,
        );
      }
      return { key, bytes: body.byteLength };
    },
    async deletePrefix(prefix) {
      let token: string | undefined;
      do {
        const listed = await client.send(
          new ListObjectsV2Command({ Bucket: S3_BUCKET, Prefix: prefix, ContinuationToken: token }),
        );
        const objects = (listed.Contents ?? []).map(o => ({ Key: o.Key as string }));
        if (objects.length) {
          await client.send(
            new DeleteObjectsCommand({ Bucket: S3_BUCKET, Delete: { Objects: objects, Quiet: true } }),
          );
        }
        token = listed.IsTruncated ? listed.NextContinuationToken : undefined;
      } while (token);
    },
    publicUrl(key) {
      // A bucket-level public URL (R2 public bucket, CloudFront, or a custom
      // domain). Falls back to the raw endpoint for MinIO-style local setups.
      const base = S3_PUBLIC_URL || `${S3_ENDPOINT ?? ""}/${S3_BUCKET}`;
      return `${base.replace(/\/+$/, "")}/${key}`;
    },
  };
}

/* --------------------------------------------------------------- local ---- */

const LOCAL_ROOT = path.join(process.cwd(), "public", "uploads");

function localDriver(): StorageDriver {
  const resolve = (key: string) => {
    // Keys are generated server-side, but never trust a path into the FS.
    const full = path.resolve(LOCAL_ROOT, key);
    if (full !== LOCAL_ROOT && !full.startsWith(LOCAL_ROOT + path.sep)) {
      throw new Error("Refusing to write outside the uploads directory");
    }
    return full;
  };

  return {
    name: "local",
    async put(key, body, _contentType) {
      const full = resolve(key);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, body);
      return { key, bytes: body.byteLength };
    },
    async deletePrefix(prefix) {
      await fs.rm(resolve(prefix), { recursive: true, force: true });
    },
    publicUrl(key) {
      return `/uploads/${key}`;
    },
  };
}

/* -------------------------------------------------------------- export ---- */

let cached: StorageDriver | null = null;

export function storage(): StorageDriver {
  if (cached) return cached;

  // Serverless filesystems are ephemeral and per-instance: photos written to
  // public/uploads in production would vanish on the next deploy and be
  // invisible to every other running instance in the meantime. Failing loudly
  // here is far kinder than silently losing a client's wedding photographs.
  if (!storageEnabled && process.env.NODE_ENV === "production") {
    const missing = [
      !S3_BUCKET && "S3_BUCKET",
      !S3_ACCESS_KEY_ID && "S3_ACCESS_KEY_ID",
      !S3_SECRET_ACCESS_KEY && "S3_SECRET_ACCESS_KEY",
    ].filter(Boolean).join(", ");
    throw new UserError(
      `Photo storage is not configured — missing ${missing}. Add it in the Vercel ` +
        `project's environment variables and redeploy. (The local-disk driver is development only.)`,
    );
  }
  // A bucket without a public URL uploads fine and then renders blank images,
  // which is far more confusing than failing here.
  if (storageEnabled && !S3_PUBLIC_URL && !S3_ENDPOINT) {
    throw new UserError("Photo storage is missing S3_PUBLIC_URL — uploads would save but never display.");
  }

  cached = storageEnabled ? s3Driver() : localDriver();
  return cached;
}
