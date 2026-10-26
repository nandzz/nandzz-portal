// My Agent (Business Agent): the owner's private WhatsApp assistant area.
// Gated by `FEATURES.businessAgent` (dev only). All tabs run on real data;
// Workflows isn't built yet.
export { MyAgentWorkspace } from "./components/MyAgentWorkspace";
export { WhatsAppChannel } from "./components/WhatsAppChannel";
export { myAgentTabFromSegment, MY_AGENT_TABS } from "./tabs";
export type { MyAgentTab } from "./tabs";
