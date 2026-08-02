"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";

export type IdeaDetailTab = "overview" | "evolution" | "comments" | "more";

interface TabItem {
  key: IdeaDetailTab;
  label: string;
  count?: number | string;
}

interface IdeaDetailTabContextValue {
  tab: IdeaDetailTab;
  setTab: (tab: IdeaDetailTab) => void;
  ideaId: string;
}

const IdeaDetailTabContext = createContext<IdeaDetailTabContextValue | null>(null);

export function useIdeaDetailTab() {
  return useContext(IdeaDetailTabContext);
}

function isValidTab(value: string | null | undefined): value is IdeaDetailTab {
  return value === "overview" || value === "evolution" || value === "comments" || value === "more";
}

export function IdeaDetailTabs({
  ideaId,
  initialTab,
  tabs,
  overview,
  evolution,
  comments,
  more,
}: {
  ideaId: string;
  initialTab: IdeaDetailTab;
  tabs: TabItem[];
  overview: ReactNode;
  evolution: ReactNode;
  comments: ReactNode;
  more: ReactNode;
}) {
  const [tab, setTabState] = useState<IdeaDetailTab>(initialTab);

  const setTab = useCallback(
    (next: IdeaDetailTab) => {
      setTabState(next);
      const url = new URL(window.location.href);
      if (next === "overview") {
        url.searchParams.delete("tab");
      } else {
        url.searchParams.set("tab", next);
      }
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    },
    []
  );

  // Sync if server/nav lands with a different ?tab=
  useEffect(() => {
    if (isValidTab(initialTab) && initialTab !== tab) {
      setTabState(initialTab);
    }
    // Only react to server-driven initialTab changes (e.g. hard navigation)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab]);

  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      const next = params.get("tab");
      setTabState(isValidTab(next) ? next : "overview");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return (
    <IdeaDetailTabContext.Provider value={{ tab, setTab, ideaId }}>
      <nav
        className="tabbar sticky-tabbar mb-5 -mx-1 overflow-x-auto px-1"
        aria-label="Idea detail content"
      >
        {tabs.map((item) => (
          <Link
            key={item.key}
            href={
              item.key === "overview"
                ? `/ideas/${ideaId}`
                : `/ideas/${ideaId}?tab=${item.key}`
            }
            scroll={false}
            data-active={tab === item.key ? "true" : undefined}
            className="tabbar-tab"
            onClick={(e) => {
              e.preventDefault();
              setTab(item.key);
            }}
          >
            <span>{item.label}</span>
            {item.count !== undefined && item.count !== "" && (
              <span className="count-badge">{item.count}</span>
            )}
          </Link>
        ))}
      </nav>

      <div hidden={tab !== "overview"}>{overview}</div>
      <div hidden={tab !== "evolution"}>{evolution}</div>
      <div hidden={tab !== "comments"} id="comments-panel">
        {comments}
      </div>
      <div hidden={tab !== "more"}>{more}</div>
    </IdeaDetailTabContext.Provider>
  );
}
