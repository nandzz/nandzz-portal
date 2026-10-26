import { describe, expect, it } from "vitest";
import { avatarImageProps } from "./avatarImage";

const SUPA = "https://lphevvdbqtqyakjmjcjl.supabase.co/storage/v1/object/public/avatars/u1/avatar.jpg?t=123";

describe("avatarImageProps", () => {
  it("routes Supabase avatars through the optimizer at 1x/2x", () => {
    const { src, srcSet } = avatarImageProps(SUPA, 112);
    expect(src).toContain("/_next/image?url=");
    expect(src).toContain(encodeURIComponent(SUPA));
    expect(srcSet).toMatch(/w=128.* 1x, .*w=256.* 2x/);
  });

  it("passes other URLs through untouched", () => {
    expect(avatarImageProps("https://lh3.googleusercontent.com/a/x", 112)).toEqual({ src: "https://lh3.googleusercontent.com/a/x" });
    expect(avatarImageProps("blob:http://localhost/abc", 112)).toEqual({ src: "blob:http://localhost/abc" });
  });

  it("returns nothing without a src", () => {
    expect(avatarImageProps(null, 112)).toEqual({});
    expect(avatarImageProps("", 112)).toEqual({});
  });
});
