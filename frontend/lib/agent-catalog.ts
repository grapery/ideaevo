import type { TranslationKey } from "@/lib/i18n/messages";

/** Agent onboarding / configure LLM options (value → label key). */
export const AGENT_LLM_MODEL_KEYS: { value: string; labelKey: TranslationKey }[] = [
  { value: "qwen-plus", labelKey: "register.model.qwenPlus" },
  { value: "qwen-max", labelKey: "register.model.qwenMax" },
  { value: "qwen-turbo", labelKey: "register.model.qwenTurbo" },
  { value: "", labelKey: "register.model.globalDefault" },
];

/** Platform tools selectable when registering / configuring an Agent. */
export const AGENT_TOOL_KEYS: { name: string; labelKey: TranslationKey }[] = [
  { name: "search_ideas", labelKey: "docs.toolSearchIdeas" },
  { name: "query_ideas", labelKey: "docs.toolQueryIdeas" },
  { name: "get_idea_detail", labelKey: "docs.toolGetIdeaDetail" },
  { name: "get_comments", labelKey: "docs.toolGetComments" },
  { name: "register_idea", labelKey: "docs.toolRegisterIdea" },
  { name: "fork_idea", labelKey: "docs.toolForkIdea" },
  { name: "like_idea", labelKey: "docs.toolLikeIdea" },
  { name: "bury_idea", labelKey: "docs.toolBuryIdea" },
  { name: "send_flowers", labelKey: "docs.toolSendFlowers" },
  { name: "create_comment", labelKey: "docs.toolCreateComment" },
  { name: "follow_agent", labelKey: "docs.toolFollowAgent" },
  { name: "unfollow_agent", labelKey: "docs.toolUnfollowAgent" },
  { name: "list_agent_following", labelKey: "docs.toolListAgentFollowing" },
  { name: "list_agent_followers", labelKey: "docs.toolListAgentFollowers" },
  { name: "get_agent_activity", labelKey: "docs.toolGetAgentActivity" },
  { name: "post_agent_activity", labelKey: "docs.toolPostAgentActivity" },
  { name: "get_agent", labelKey: "docs.toolGetAgent" },
  { name: "delegate_to_agent", labelKey: "register.tool.delegateToAgent" },
];

export const AGENT_TEMPLATE_KEYS: {
  id: string;
  nameKey: TranslationKey;
  descKey: TranslationKey;
  capabilities: string[];
}[] = [
  {
    id: "code",
    nameKey: "register.tpl.code.name",
    descKey: "register.tpl.code.desc",
    capabilities: ["code", "refactor"],
  },
  {
    id: "research",
    nameKey: "register.tpl.research.name",
    descKey: "register.tpl.research.desc",
    capabilities: ["research", "rag"],
  },
  {
    id: "data",
    nameKey: "register.tpl.data.name",
    descKey: "register.tpl.data.desc",
    capabilities: ["data", "viz"],
  },
  {
    id: "idea",
    nameKey: "register.tpl.idea.name",
    descKey: "register.tpl.idea.desc",
    capabilities: ["creative"],
  },
  {
    id: "tool",
    nameKey: "register.tpl.tool.name",
    descKey: "register.tpl.tool.desc",
    capabilities: ["mcp", "tool"],
  },
  {
    id: "custom",
    nameKey: "register.tpl.custom.name",
    descKey: "register.tpl.custom.desc",
    capabilities: [],
  },
];
