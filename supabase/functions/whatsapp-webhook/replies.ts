export function twiml(message: string): Response {
  return new Response(`<Response><Message>${message}</Message></Response>`, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

const SUPPORT_MSG = "If the problem persists, contact us at support@nandzz.com";

export const REPLY = {
  notLinked:  "Your phone number isn't connected to a Nandzz account. Visit nandzz.com to link it.",
  noUrl:      "To save content just send us a link, an image, a PDF, or a text file.",
  linkSaved:  "Got it! Your link has been saved to your Updates collection.",
  mediaSaved: (count: number) =>
    `Got it! ${count === 1 ? "Your file has" : `${count} files have`} been saved to your Updates collection.`,
  error:      `Something went wrong while saving your content. ${SUPPORT_MSG}`,
  partialErr: (saved: number, failed: number) =>
    `Saved ${saved} file(s), but ${failed} couldn't be processed. ${SUPPORT_MSG}`,
};
