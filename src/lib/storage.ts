import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { put as blobPut, list as blobList, del as blobDel } from "@vercel/blob";
import { UserError } from "./errors";

/**
 * Object storage behind one small interface.
 *
 * Three drivers ship, selected automatically by which credentials are present:
 *  - `blob`  — Vercel Blob. Preferred on Vercel because the platform injects
 *              BLOB_READ_WRITE_TOKEN when the store is connected: no API token
 *              to mint, no account id, no endpoint, no separate public URL.
 *  - `s3`    — any S3-compatible endpoint. Cloudflare R2, AWS S3, Backblaze B2
 *              and MinIO all work by changing env vars only; no code branches
 *              on the vendor. Cheaper at scale (R2 charges no egress).
 *  - `local` — writes under `public/uploads`, chosen when neither of the above
 *              is configured. Same contract as the Stripe and Resend dev
 *              fallbacks already here: the app stays runnable with an empty .env.
 *
 * Everything above this module only ever sees an opaque storage key and the URL
 * `publicUrl()` derives from it, so switching providers never touches the image
 * pipeline, the photo service, or the rendering components.
 *
 * One wrinkle the interface absorbs: S3 keys are paths we choose, whereas Blob
 * mints the URL server-side. The Blob driver therefore returns the absolute URL
 * as the key and `publicUrl()` passes absolute keys straight through — which is
 * why `put()` returns the stored key rather than the caller assuming it.
 */

export type StoredObject = { key: string; bytes: number };

export interface StorageDriver {
  readonly name: "blob" | "s3" | "local";
  /** Returns the canonical key to persist — not necessarily the one passed in. */
  put(key: string, body: Buffer, contentType: string): Promise<StoredObject>;
  /** Delete every object under a prefix. Must be safe to call twice. */
  deletePrefix(prefix: string): Promise<void>;
  /** Browser-resolvable URL for a stored key. */
  publicUrl(key: string): string;
}

const {
  BLOB_READ_WRITE_TOKEN,
  S3_BUCKET,
  S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY,
  S3_ENDPOINT,
  S3_REGION,
  S3_PUBLIC_URL,
} = process.env;

export const blobEnabled = Boolean(BLOB_READ_WRITE_TOKEN);
export const s3Enabled = Boolean(S3_BUCKET && S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY);
export const storageEnabled = blobEnabled || s3Enabled;

/** Derivatives are content-addressed and never rewritten — cache them forever. */
const IMMUTABLE_SECONDS = 31_536_000;

/* --------------------------------------------------------- Vercel Blob ---- */

function blobDriver(): StorageDriver {
  return {
    name: "blob",
    async put(key, body, contentType) {
      try {
        const { url } = await blobPut(key, body, {
          access: "public",
          contentType,
          // Keep our own path scheme intact so deletePrefix can find these again.
          addRandomSuffix: false,
          cacheControlMaxAge: IMMUTABLE_SECONDS,
        });
        // Blob owns the hostname, so the absolute URL *is* the durable key.
        return { key: url, bytes: body.byteLength };
      } catch (err) {
        const name = err instanceof Error ? err.name : "UnknownError";
        console.error(`[storage] Blob put failed key=${key}`, err);
        throw new UserError(
          `Storage rejected the upload (${name}). Check that a Blob store is connected to this project.`,
        );
      }
    },
    async deletePrefix(prefix) {
      let cursor: string | undefined;
      do {
        const page = await blobList({ prefix, cursor });
        if (page.blobs.length) await blobDel(page.blobs.map(b => b.url));
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
    },
    publicUrl(key) {
      return key; // already absolute
    },
  };
}

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
    throw new UserError(
      "Photo storage is not configured. Connect a Blob store in the Vercel dashboard " +
        "(Storage → Create → Blob → Connect to project) and redeploy — Vercel injects " +
        "BLOB_READ_WRITE_TOKEN for you. Alternatively set the S3_* variables for an " +
        "S3-compatible bucket. (The local-disk driver is development only.)",
    );
  }
  // An S3 bucket without a public URL uploads fine and then renders blank
  // images, which is far more confusing than failing here. Blob is exempt: it
  // returns its own absolute URLs.
  if (!blobEnabled && s3Enabled && !S3_PUBLIC_URL && !S3_ENDPOINT) {
    throw new UserError("Photo storage is missing S3_PUBLIC_URL — uploads would save but never display.");
  }

  // Blob wins when both are present: on Vercel it needs no manual configuration,
  // so it is the safer default if someone leaves half-finished S3 vars behind.
  cached = blobEnabled ? blobDriver() : s3Enabled ? s3Driver() : localDriver();
  console.log(`[storage] driver=${cached.name}`);
  return cached;
}
