export async function computeTwilioSignature(
  authToken: string,
  requestUrl: string,
  params: Record<string, string>,
): Promise<string> {
  const sortedKeys = Object.keys(params).sort();
  const payload = requestUrl + sortedKeys.map((k) => k + params[k]).join("");

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export async function verifyTwilioSignature(
  authToken: string,
  requestUrl: string,
  params: Record<string, string>,
  signatureHeader: string,
): Promise<boolean> {
  const expected = await computeTwilioSignature(authToken, requestUrl, params);
  console.log("[twilio] expected sig:", expected);
  console.log("[twilio] received sig:", signatureHeader);
  return expected === signatureHeader;
}
