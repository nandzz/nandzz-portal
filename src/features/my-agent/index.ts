// My Agent (Business Agent): the owner's private WhatsApp assistant area.
// Gated by `FEATURES.businessAgent` (dev only). Activity + approvals run on real
// data; the other tabs are still placeholders.
export { MyAgentWorkspace } from "./components/MyAgentWorkspace";
export { WhatsAppChannel } from "./components/WhatsAppChannel";
export { myAgentTabFromSegment, MY_AGENT_TABS } from "./tabs";
export type { MyAgentTab } from "./tabs";
