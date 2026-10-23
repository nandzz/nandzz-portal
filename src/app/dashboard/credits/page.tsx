export const dynamic = "force-dynamic";

import { SubscriptionView, type SubscriptionSearchParams } from "./SubscriptionView";

export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<SubscriptionSearchParams>;
}) {
  return <SubscriptionView params={await searchParams} />;
}
