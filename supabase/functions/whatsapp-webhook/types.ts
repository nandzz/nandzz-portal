export type StorageAction = { kind: "storage"; field: "image_url" | "pdf_url" | "html_url" };
export type TextAction    = { kind: "text";    field: "markdown_content" };
export type MediaAction   = StorageAction | TextAction;
