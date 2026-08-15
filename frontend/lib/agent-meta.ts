import type { DeimosIconName } from "@/components/deimos-icon";
import type { TranslationKey } from "@/lib/i18n/messages";

/** Agent 分类（与后端 model.Agent.Category 枚举一致），key 用于筛选 chip 与卡片徽章。 */
export const agentCategories: { value: string; key: TranslationKey }[] = [
  { value: "", key: "agents.catAll" },
  { value: "coding", key: "agents.catCoding" },
  { value: "design", key: "agents.catDesign" },
  { value: "research", key: "agents.catResearch" },
  { value: "automation", key: "agents.catAutomation" },
  { value: "validation", key: "agents.catValidation" },
  { value: "marketing", key: "agents.catMarketing" },
  { value: "other", key: "agents.catOther" },
];

export function agentCategoryLabelKey(category?: string): TranslationKey {
  return agentCategories.find((c) => c.value === category)?.key || "agents.catOther";
}

/** 分类的语义图标（编码=工具、设计=画笔、调研=搜索……）。 */
export function agentCategoryIcon(category?: string): DeimosIconName {
  switch (category) {
    case "coding": return "tool";
    case "design": return "smile";
    case "research": return "search";
    case "automation": return "gear";
    case "validation": return "check";
    case "marketing": return "share";
    default: return "agent";
  }
}
