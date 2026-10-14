import type { ToolDefinition, ToolHandler } from "../mcp/tools/types.ts";
import { listCollections, listCollectionsDef } from "../mcp/tools/list_collections.ts";
import { publishHtml, publishHtmlDef } from "../mcp/tools/publish_html.ts";
import { publishPdf, publishPdfDef } from "../mcp/tools/publish_pdf.ts";
import { publishImage, publishImageDef } from "../mcp/tools/publish_image.ts";
import { updateHtml, updateHtmlDef } from "../mcp/tools/update_html.ts";
import { updatePdf, updatePdfDef } from "../mcp/tools/update_pdf.ts";
import { updateImage, updateImageDef } from "../mcp/tools/update_image.ts";
import { updateSpaceMetadata, updateSpaceMetadataDef } from "../mcp/tools/update_space_metadata.ts";
import { onDemo } from "./tools/_demo.ts";
import { createDemoProfile, createDemoProfileDef } from "./tools/create_demo_profile.ts";
import { updateDemoProfile, updateDemoProfileDef } from "./tools/update_demo_profile.ts";
import { listDemoProfiles, listDemoProfilesDef } from "./tools/list_demo_profiles.ts";
import { deleteDemoProfile, deleteDemoProfileDef } from "./tools/delete_demo_profile.ts";
import { createClaimCode, createClaimCodeDef } from "./tools/create_claim_code.ts";
import { publishLink, publishLinkDef } from "./tools/publish_link.ts";
import { getDemoProfile, getDemoProfileDef } from "./tools/get_demo_profile.ts";
import { deleteSpace, deleteSpaceDef } from "./tools/delete_space.ts";
import { findProfile, findProfileDef } from "./tools/find_profile.ts";
import {
  configureBookingWidget,
  configureBookingWidgetDef,
  getBookingWidget,
  getBookingWidgetDef,
} from "./tools/booking_widget.ts";

// Public-MCP content tools, re-targeted at a profile (required
// demo_profile_id; ctx.userId swapped to the target after requireTarget: a
// demo, or a real account with owner-granted support access). The public
// booking tools (list_availability / book_appointment) are not exposed —
// configure_booking_widget is used instead.
const demoTools = [
  onDemo(listCollectionsDef, listCollections),
  onDemo(publishHtmlDef, publishHtml),
  onDemo(publishPdfDef, publishPdf),
  onDemo(publishImageDef, publishImage),
  onDemo(updateHtmlDef, updateHtml),
  onDemo(updatePdfDef, updatePdf),
  onDemo(updateImageDef, updateImage),
  onDemo(updateSpaceMetadataDef, updateSpaceMetadata),
];

export const toolDefinitions: ToolDefinition[] = [
  createDemoProfileDef,
  updateDemoProfileDef,
  getDemoProfileDef,
  listDemoProfilesDef,
  findProfileDef,
  deleteDemoProfileDef,
  createClaimCodeDef,
  publishLinkDef,
  deleteSpaceDef,
  configureBookingWidgetDef,
  getBookingWidgetDef,
  ...demoTools.map((t) => t.def),
];

export const toolHandlers: Record<string, ToolHandler> = {
  create_demo_profile: createDemoProfile,
  update_demo_profile: updateDemoProfile,
  get_demo_profile: getDemoProfile,
  delete_space: deleteSpace,
  list_demo_profiles: listDemoProfiles,
  find_profile: findProfile,
  delete_demo_profile: deleteDemoProfile,
  create_claim_code: createClaimCode,
  publish_link: publishLink,
  configure_booking_widget: configureBookingWidget,
  get_booking_widget: getBookingWidget,
  ...Object.fromEntries(demoTools.map((t) => [t.def.name, t.handler])),
};
