// Test doubles for the MCP handlers. The real ctx.admin is a Supabase client
// with a chained builder; the handlers only touch the narrow slice below, so
// this fake records every call and returns whatever the test wired up.

import type { Ctx } from "../tools/types.ts";

export type RpcCall = { name: string; args: Record<string, unknown> | undefined };

export type FromCall = {
  table: string;
  select?: string;
  eq: Array<[string, unknown]>;
  // Range / null filters as [op, column, value] (gte, lte, is).
  filters: Array<[string, string, unknown]>;
  or: string[];
  order: Array<[string, unknown]>;
  insert?: Record<string, unknown>;
  update?: Record<string, unknown>;
  terminal: "maybeSingle" | "then" | "insert" | "update" | null;
};

export type StorageUpload = {
  bucket: string;
  path: string;
  bytes: Uint8Array | string;
  contentType?: string;
  upsert?: boolean;
};

export type FakeResult<T = unknown> = { data?: T; error?: unknown };

export type FromResponses = {
  // `select`ing on this table returns this (used by list_collections & attachToCollection lookup).
  select?: FakeResult;
  // `insert` returns this (used by attachToCollection insert).
  insert?: FakeResult;
  // `update()...eq()...eq()` returns this (used by update_* tools).
  update?: FakeResult;
};

export type FakeAdminOptions = {
  rpc?: Record<string, FakeResult>;
  from?: Record<string, FromResponses>;
  upload?: FakeResult;
  publicUrlBase?: string;
};

export type FakeAdmin = {
  rpcCalls: RpcCall[];
  fromCalls: FromCall[];
  storageUploads: StorageUpload[];
  ctx: Ctx;
};

export function makeCtx(opts: FakeAdminOptions = {}): FakeAdmin {
  const rpcCalls: RpcCall[] = [];
  const fromCalls: FromCall[] = [];
  const storageUploads: StorageUpload[] = [];
  const publicUrlBase = opts.publicUrlBase ?? "https://cdn.example/";

  const admin = {
    rpc(name: string, args?: Record<string, unknown>) {
      rpcCalls.push({ name, args });
      const wired = opts.rpc?.[name];
      return Promise.resolve(wired ?? { data: null, error: null });
    },
    from(table: string) {
      const call: FromCall = { table, eq: [], filters: [], or: [], order: [], terminal: null };
      fromCalls.push(call);
      // getUsername() looks up profiles.username after every publish/update to
      // build the sharable space URL. Seed a default so existing tests don't
      // have to wire profiles up; tests can still override via opts.from.
      const defaultProfiles: FromResponses = {
        select: { data: { username: "user-1" }, error: null },
      };
      const responses = opts.from?.[table] ?? (table === "profiles" ? defaultProfiles : {});
      let mode: "select" | "update" = "select";
      const chain = {
        select(cols: string) {
          call.select = cols;
          return chain;
        },
        eq(col: string, val: unknown) {
          call.eq.push([col, val]);
          return chain;
        },
        gte(col: string, val: unknown) {
          call.filters.push(["gte", col, val]);
          return chain;
        },
        lte(col: string, val: unknown) {
          call.filters.push(["lte", col, val]);
          return chain;
        },
        is(col: string, val: unknown) {
          call.filters.push(["is", col, val]);
          return chain;
        },
        or(expr: string) {
          call.or.push(expr);
          return chain;
        },
        order(col: string, val: unknown) {
          call.order.push([col, val]);
          return chain;
        },
        maybeSingle() {
          call.terminal = "maybeSingle";
          return Promise.resolve(responses.select ?? { data: null, error: null });
        },
        insert(row: Record<string, unknown>) {
          call.insert = row;
          call.terminal = "insert";
          return Promise.resolve(responses.insert ?? { error: null });
        },
        update(row: Record<string, unknown>) {
          call.update = row;
          call.terminal = "update";
          mode = "update";
          return chain;
        },
        // list_collections awaits the builder directly after chaining .order();
        // update_* tools await after chaining .update().eq().eq(). Simulate both.
        then(res: (v: FakeResult) => void) {
          if (mode === "update") {
            res(responses.update ?? { error: null });
          } else {
            call.terminal = "then";
            res(responses.select ?? { data: [], error: null });
          }
        },
      };
      return chain;
    },
    storage: {
      from(bucket: string) {
        return {
          upload(
            path: string,
            bytes: Uint8Array | string,
            uploadOpts: { contentType?: string; upsert?: boolean },
          ) {
            storageUploads.push({
              bucket,
              path,
              bytes,
              contentType: uploadOpts?.contentType,
              upsert: uploadOpts?.upsert,
            });
            return Promise.resolve(opts.upload ?? { error: null });
          },
          getPublicUrl(path: string) {
            return { data: { publicUrl: `${publicUrlBase}${bucket}/${path}` } };
          },
        };
      },
    },
  };

  const ctx: Ctx = {
    admin: admin as unknown as Ctx["admin"],
    userId: "user-1",
    rid: "req-1",
  };

  return { rpcCalls, fromCalls, storageUploads, ctx };
}

// The MCP RPC returns a row per publish_space_tx contract: space_id plus the
// caller's current AI credit balances (plan_credits / paid_credits).
export function publishOk(
  spaceId = "space-1",
  plan = 90,
  paid = 0,
): FakeResult {
  return {
    data: [
      { space_id: spaceId, plan_credits: plan, paid_credits: paid },
    ],
    error: null,
  };
}
