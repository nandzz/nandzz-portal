import { listCollections, listCollectionsDef } from "./list_collections.ts";
import { publishHtml, publishHtmlDef } from "./publish_html.ts";
import { publishPdf, publishPdfDef } from "./publish_pdf.ts";
import { publishImage, publishImageDef } from "./publish_image.ts";
import type { ToolDefinition, ToolHandler } from "./types.ts";

export const toolDefinitions: ToolDefinition[] = [
  listCollectionsDef,
  publishHtmlDef,
  publishPdfDef,
  publishImageDef,
];

export const toolHandlers: Record<string, ToolHandler> = {
  list_collections: listCollections,
  publish_html: publishHtml,
  publish_pdf: publishPdf,
  publish_image: publishImage,
};
