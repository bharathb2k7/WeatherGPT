import React from "react";
import {
  Sprout,
  Anchor,
  Car,
  Umbrella,
  CloudRain,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { QUICK_PROMPTS } from "../data/constants";
import { QuickPrompt, SupportedLanguageCode } from "../types";
import { getUiTranslation } from "../data/languages";

interface QuickPromptsBarProps {
  onSelectPrompt: (promptText: string) => void;
  disabled?: boolean;
  language: SupportedLanguageCode;
}

export const QuickPromptsBar: React.FC<QuickPromptsBarProps> = ({
  onSelectPrompt,
  disabled,
  language,
}) => {
  const ui = getUiTranslation(language);

  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case "Sprout":
        return <Sprout className="w-3.5 h-3.5 text-emerald-700 shrink-0" />;
      case "Anchor":
        return <Anchor className="w-3.5 h-3.5 text-sky-700 shrink-0" />;
      case "Umbrella":
        return <Umbrella className="w-3.5 h-3.5 text-amber-700 shrink-0" />;
      case "CloudRain":
        return <CloudRain className="w-3.5 h-3.5 text-indigo-700 shrink-0" />;
      case "AlertTriangle":
        return <AlertTriangle className="w-3.5 h-3.5 text-rose-700 shrink-0" />;
      default:
        return <CloudRain className="w-3.5 h-3.5 text-indigo-700 shrink-0" />;
    }
  };

  const getPersonaBadge = (persona: QuickPrompt["persona"]) => {
    switch (persona) {
      case "farmer":
        return {
          label: ui.farmer,
          style: "bg-emerald-100 text-emerald-800 border-emerald-200",
        };
      case "fisher":
        return {
          label: ui.fisher,
          style: "bg-sky-100 text-sky-800 border-sky-200",
        };
      case "commuter":
        return {
          label: ui.commuter,
          style: "bg-amber-100 text-amber-900 border-amber-200",
        };
      default:
        return {
          label: ui.citizen,
          style: "bg-stone-100 text-stone-700 border-stone-200",
        };
    }
  };

  return (
    <div id="quick-prompts-bar" className="w-full pb-1">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-0.5">
        <div className="flex items-center gap-1 text-[11px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap shrink-0 pr-1">
          <Sparkles className="w-3 h-3 text-amber-700" />
          <span>{ui.quickQueries}</span>
        </div>

        {QUICK_PROMPTS.map((item) => {
          const displayPrompt =
            item.promptTranslations?.[language] ||
            (language === "te" && item.promptTelugu ? item.promptTelugu : undefined) ||
            item.prompt;
          const badge = getPersonaBadge(item.persona);

          return (
            <button
              key={item.id}
              id={`btn-prompt-${item.id}`}
              onClick={() => onSelectPrompt(displayPrompt)}
              disabled={disabled}
              className="group flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-medium bg-white hover:bg-stone-50 border border-stone-300/80 hover:border-amber-600/50 text-stone-800 hover:text-stone-900 transition-all shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
              title={`Ask: "${displayPrompt}"`}
            >
              {renderIcon(item.icon)}
              <span className="truncate max-w-[210px] sm:max-w-none font-normal">
                {displayPrompt}
              </span>
              <span
                className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${badge.style}`}
              >
                {badge.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
