-- How the public profile's image gallery shows each photo's title + caption
-- (spaces.title / spaces.description) on top of the tile:
--   'none'     -> image only (today's look; default so existing profiles are unchanged)
--   'gradient' -> dark bottom gradient with the text always visible
--   'hover'    -> full-tile dark overlay revealed on hover (always shown on touch)
--   'card'     -> frosted glass card floating at the bottom of the tile
-- Plain text to match the loose-string convention of `gallery_layout`.
alter table public.profiles
  add column if not exists gallery_caption_style text not null default 'none';
