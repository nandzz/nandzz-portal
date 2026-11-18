import type { ComponentType } from "react";
import { PdfBuilder } from "./PdfBuilder";
import { NotesBuilder } from "./NotesBuilder";
import { ImageBuilder } from "./ImageBuilder";
import { LinkBuilder } from "./LinkBuilder";
import type { BuilderFieldsProps, CreatableContentTypeId } from "./types";

export type { CreatableContentTypeId, BuilderFieldsProps };

/**
 * Maps each creatable content type to its builder component. A future
 * routing task (create-space / edit-space pages) imports this to render the
 * right builder for a given type — e.g.
 * `BUILDER_REGISTRY[type].component`.
 */
export const BUILDER_REGISTRY: Record<CreatableContentTypeId, { component: ComponentType<BuilderFieldsProps> }> = {
  pdf: { component: PdfBuilder },
  notes: { component: NotesBuilder },
  image: { component: ImageBuilder },
  link: { component: LinkBuilder },
};
