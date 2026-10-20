// Google's write-review deep link: opens the "rate and review" dialog for the
// listing (Maps app on mobile, web on desktop). Needs an establishment place_id.
export function googleReviewUrl(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}
