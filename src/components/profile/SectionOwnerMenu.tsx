"use client";

import { Settings2, Check, ChevronUp, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  GALLERY_CAPTION_ICONS,
  SECTION_LAYOUT_ICONS,
  getGalleryCaptionStyleLabel,
  getSectionLayoutLabel,
  type GalleryCaptionStyle,
  type SectionId,
  type SectionLayout,
} from "@/lib/gallery/layouts";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSectionOrder } from "./section-order-context";

interface SectionOwnerMenuProps {
  sectionId: SectionId;
  /** Human name of the section, for the trigger's accessible label. */
  sectionName: string;
  /** Layouts to offer, in menu order. */
  layouts: SectionLayout[];
  layout: SectionLayout;
  onLayoutChange: (next: SectionLayout) => void;
  /** Gallery only: title/caption overlay styles to offer below the layouts. */
  captions?: {
    styles: GalleryCaptionStyle[];
    value: GalleryCaptionStyle;
    onChange: (next: GalleryCaptionStyle) => void;
  };
}

/**
 * The single owner control in a profile section header: one icon button that
 * opens a menu with the section's layout choices and (when there's more than
 * one section) move up / move down. Consolidating layout + ordering into one
 * trigger keeps the header uncluttered — visitors see none of this. */
export function SectionOwnerMenu({
  sectionId,
  sectionName,
  layouts,
  layout,
  onLayoutChange,
  captions,
}: SectionOwnerMenuProps) {
  const { t } = useLanguage();
  const order = useSectionOrder();

  const idx = order ? order.order.indexOf(sectionId) : -1;
  const canReorder = !!order && order.order.length > 1 && idx !== -1;
  const canUp = canReorder && idx > 0;
  const canDown = canReorder && idx < order!.order.length - 1;

  const triggerLabel = `${sectionName} · ${t.profile.sectionSettings}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-owner-only
        aria-label={triggerLabel}
        title={triggerLabel}
        className="flex items-center justify-center rounded-full border border-border/60 bg-background/80 p-1.5 text-muted-foreground shadow-sm backdrop-blur-sm transition-[transform,color,border-color] duration-150 ease-out hover:border-violet-500/50 hover:text-foreground active:scale-95"
      >
        <Settings2 className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuRadioGroup
          value={layout}
          onValueChange={(v) => onLayoutChange(v as SectionLayout)}
        >
          {layouts.map((id) => {
            const Icon = SECTION_LAYOUT_ICONS[id];
            return (
              <DropdownMenuRadioItem
                key={id}
                value={id}
                className="pl-2 [&>span:first-child]:hidden"
              >
                <Icon className="mr-2 h-3.5 w-3.5" />
                <span className="flex-1">{getSectionLayoutLabel(t, id)}</span>
                {layout === id && <Check className="h-3.5 w-3.5 text-violet-500" />}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>

        {captions && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {t.profile.captionsLabel}
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={captions.value}
                onValueChange={(v) => captions.onChange(v as GalleryCaptionStyle)}
              >
                {captions.styles.map((id) => {
                  const Icon = GALLERY_CAPTION_ICONS[id];
                  return (
                    <DropdownMenuRadioItem
                      key={id}
                      value={id}
                      className="pl-2 [&>span:first-child]:hidden"
                    >
                      <Icon className="mr-2 h-3.5 w-3.5" />
                      <span className="flex-1">{getGalleryCaptionStyleLabel(t, id)}</span>
                      {captions.value === id && <Check className="h-3.5 w-3.5 text-violet-500" />}
                    </DropdownMenuRadioItem>
                  );
                })}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </>
        )}

        {canReorder && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={!canUp} onClick={() => order!.move(sectionId, -1)}>
              <ChevronUp className="mr-2 h-3.5 w-3.5" />
              {t.profile.moveUp}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!canDown} onClick={() => order!.move(sectionId, 1)}>
              <ChevronDown className="mr-2 h-3.5 w-3.5" />
              {t.profile.moveDown}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
