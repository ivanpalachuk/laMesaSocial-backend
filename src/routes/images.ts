import { Hono, type Context } from "hono";
import { authMiddleware, type AppEnv } from "../middleware/auth";

const imagesRoutes = new Hono<AppEnv>();
const RAW_IMAGE_PREFIX = "/api/images/raw/";

const IMAGE_MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const ALLOWED_FITS = ["scale-down", "contain", "cover", "crop", "pad"] as const;
type ImageFit = (typeof ALLOWED_FITS)[number];

function parsePositiveInt(value: string | null, max: number) {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return Math.min(parsed, max);
}

function parseQuality(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return null;
  return Math.min(parsed, 100);
}

function getImageKeyFromUrl(requestUrl: string, prefix: string) {
  const urlPath = new URL(requestUrl).pathname;
  const rawKey = urlPath.startsWith(prefix) ? urlPath.slice(prefix.length) : "";
  try {
    return decodeURIComponent(rawKey);
  } catch {
    return "";
  }
}

function buildPublicImageUrl(origin: string, key: string) {
  const encoded = key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  return `${origin}/api/images/${encoded}`;
}

imagesRoutes.post("/upload", authMiddleware, async (c) => {
  const formData = await c.req.formData();
  const fileEntry = formData.get("file");
  const folderRaw = String(formData.get("folder") ?? "encuentros");
  const folder = folderRaw.replace(/[^a-zA-Z0-9/_-]/g, "") || "encuentros";

  if (!fileEntry || typeof fileEntry === "string") {
    return c.json({ error: "Missing file" }, 400);
  }

  const file = fileEntry as unknown as {
    type?: string;
    size?: number;
    name?: string;
    arrayBuffer: () => Promise<ArrayBuffer>;
  };

  const extension = IMAGE_MIME_EXT[file.type ?? ""];
  if (!extension) {
    return c.json({ error: "Unsupported image format. Use JPG, PNG or WEBP." }, 400);
  }

  const maxBytes = folder === "avatars" ? 512 * 1024 : 5 * 1024 * 1024;
  if ((file.size ?? 0) > maxBytes) {
    return c.json(
      { error: folder === "avatars" ? "Avatar exceeds 512KB limit." : "Image exceeds 5MB limit." },
      400,
    );
  }

  const userId = c.get("userId");
  const key =
    folder === "avatars"
      ? `avatars/${userId}/${crypto.randomUUID()}.${extension}`
      : `${folder}/${crypto.randomUUID()}.${extension}`;
  const contentType = file.type || "application/octet-stream";

  await c.env.IMAGES.put(key, await file.arrayBuffer(), {
    httpMetadata: {
      contentType,
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: {
      uploadedBy: c.get("userId"),
      originalName: file.name ?? "unknown",
    },
  });

  const origin = new URL(c.req.url).origin;

  return c.json({
    key,
    url: buildPublicImageUrl(origin, key),
  });
});

function parseFit(value: string | null): ImageFit | undefined {
  return ALLOWED_FITS.find((fit) => fit === value);
}

async function serveOriginalImage(c: Context<AppEnv>, prefix = RAW_IMAGE_PREFIX) {
  const key = getImageKeyFromUrl(c.req.url, prefix);

  if (!key) {
    return c.json({ error: "Missing key" }, 400);
  }

  const object = await c.env.IMAGES.get(key);

  if (!object) {
    return c.json({ error: "Image not found" }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  if (!headers.has("cache-control")) {
    headers.set("cache-control", "public, max-age=31536000, immutable");
  }

  return new Response(object.body, {
    headers,
  });
}

imagesRoutes.get("/raw/*", async (c) => {
  return serveOriginalImage(c);
});

imagesRoutes.get("/*", async (c) => {
  const key = getImageKeyFromUrl(c.req.url, "/api/images/");

  if (!key) {
    return c.json({ error: "Missing key" }, 400);
  }

  const url = new URL(c.req.url);
  const width = parsePositiveInt(url.searchParams.get("w"), 2400);
  const height = parsePositiveInt(url.searchParams.get("h"), 2400);
  const quality = parseQuality(url.searchParams.get("q"));
  const fit = parseFit(url.searchParams.get("fit"));
  const wantsTransform = Boolean(width || height || quality || fit);

  if (!wantsTransform) {
    return serveOriginalImage(c, "/api/images/");
  }

  const object = await c.env.IMAGES.get(key);

  if (!object) {
    return c.json({ error: "Image not found" }, 404);
  }

  try {
    const transform: ImageTransform = {
      ...(width ? { width } : {}),
      ...(height ? { height } : {}),
      ...(fit ? { fit } : {}),
    };
    const transformed = await c.env.IMAGE_TRANSFORMER
      .input(object.body)
      .transform(transform)
      .output({
        format: "image/webp",
        ...(quality ? { quality } : {}),
      });
    const response = transformed.response();
    const headers = new Headers(response.headers);
    if (!headers.has("cache-control")) {
      headers.set("cache-control", "public, max-age=31536000, immutable");
    }

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch {
    return c.json({ error: "Image transform failed" }, 400);
  }
});

export default imagesRoutes;
