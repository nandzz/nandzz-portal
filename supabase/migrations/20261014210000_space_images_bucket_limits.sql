-- Enforce the content-image limits server-side. The browser downscales photos
-- before upload (compress-image.ts) and the MCP / WhatsApp paths already cap
-- at 5 MB with these types, but the bucket itself had no limit, so a direct
-- storage API call could bypass the client checks. SVG is deliberately not
-- allowed (served from a public bucket → stored-XSS vector).
update storage.buckets
set
  file_size_limit = 5242880, -- 5 MB
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
where id = 'space-images';
