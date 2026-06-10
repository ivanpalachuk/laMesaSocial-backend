import { Hono } from "hono";
import { authMiddleware, type AppEnv } from "../middleware/auth";

const imagesRoutes = new Hono<AppEnv>();

const IMAGE_MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

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

  if ((file.size ?? 0) > 5 * 1024 * 1024) {
    return c.json({ error: "Image exceeds 5MB limit." }, 400);
  }

  const key = `${folder}/${crypto.randomUUID()}.${extension}`;
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

imagesRoutes.get("/*", async (c) => {
  // c.req.param('*') is empty in Hono sub-routers; extract key from the raw URL path instead.
  const urlPath = new URL(c.req.url).pathname;
  const prefix = "/api/images/";
  const rawKey = urlPath.startsWith(prefix) ? urlPath.slice(prefix.length) : (c.req.param("*") ?? "");
  const key = decodeURIComponent(rawKey);

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
});

export default imagesRoutes;
