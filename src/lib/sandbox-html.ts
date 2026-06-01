const SANDBOX_CSP =
  `<meta http-equiv="Content-Security-Policy" content="connect-src 'none'; worker-src 'none'; child-src 'none';">` +
  `<base target="_blank" rel="noopener noreferrer">`;

/**
 * Inject a restrictive CSP into user-supplied HTML before rendering in an iframe.
 * Blocks all outbound network calls (fetch/XHR/WebSocket) and worker creation,
 * preventing crypto mining and data exfiltration from untrusted content.
 */
export function sandboxHtml(html: string): string {
  const headMatch = html.match(/<head[^>]*>/i);
  if (headMatch) {
    return html.replace(headMatch[0], headMatch[0] + SANDBOX_CSP);
  }
  return SANDBOX_CSP + html;
}
