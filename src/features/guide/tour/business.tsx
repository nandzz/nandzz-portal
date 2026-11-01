"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Location } from "@/lib/types";

// A real (demo) business the tour screens show instead of Studio Lume, for the
// per-business demo videos (/kit/tour?page=<username>). Only what the business
// set up itself comes from here: name, location, staff, services, prices and
// hours. Customers and their bookings stay sample data.
export type TourBusiness = {
  name: string;
  username: string;
  avatarUrl: string | null;
  currency: string; // ISO 4217, lowercase
  timezone: string;
  location: Location;
};

const TourBusinessContext = createContext<TourBusiness | null>(null);

export function TourBusinessProvider({ business, children }: { business: TourBusiness | null; children: ReactNode }) {
  return <TourBusinessContext.Provider value={business}>{children}</TourBusinessContext.Provider>;
}

/** The business the screens are about, or null for the Studio Lume sample (/guide). */
export const useTourBusiness = () => useContext(TourBusinessContext);
