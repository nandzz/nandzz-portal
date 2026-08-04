import { listCollections, listCollectionsDef } from "./list_collections.ts";
import { publishHtml, publishHtmlDef } from "./publish_html.ts";
import { publishPdf, publishPdfDef } from "./publish_pdf.ts";
import { publishImage, publishImageDef } from "./publish_image.ts";
import { updateHtml, updateHtmlDef } from "./update_html.ts";
import { updatePdf, updatePdfDef } from "./update_pdf.ts";
import { updateImage, updateImageDef } from "./update_image.ts";
import { updateSpaceMetadata, updateSpaceMetadataDef } from "./update_space_metadata.ts";
import { listAvailability, listAvailabilityDef } from "./list_availability.ts";
import { bookAppointment, bookAppointmentDef } from "./book_appointment.ts";
import type { ToolDefinition, ToolHandler } from "./types.ts";

export const toolDefinitions: ToolDefinition[] = [
  listCollectionsDef,
  publishHtmlDef,
  publishPdfDef,
  publishImageDef,
  updateHtmlDef,
  updatePdfDef,
  updateImageDef,
  updateSpaceMetadataDef,
  listAvailabilityDef,
  bookAppointmentDef,
];

export const toolHandlers: Record<string, ToolHandler> = {
  list_collections: listCollections,
  publish_html: publishHtml,
  publish_pdf: publishPdf,
  publish_image: publishImage,
  update_html: updateHtml,
  update_pdf: updatePdf,
  update_image: updateImage,
  update_space_metadata: updateSpaceMetadata,
  list_availability: listAvailability,
  book_appointment: bookAppointment,
};
