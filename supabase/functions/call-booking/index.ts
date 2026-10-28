import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCallBooking, type AdminClientLike } from "./handler.ts";

// Thin entrypoint: the logic (and its docs) live in handler.ts.
serve((req) =>
  handleCallBooking(req, {
    apiKey: Deno.env.get("OPENAI_API_KEY"),
    admin: createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    ) as unknown as AdminClientLike,
    fetch,
  })
);
