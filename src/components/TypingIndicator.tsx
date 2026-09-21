import React from "react";
import { CloudSun } from "lucide-react";

interface TypingIndicatorProps {
  locationName: string;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  locationName,
}) => {
  return (
    <div className="flex items-start gap-3 my-4 animate-in fade-in duration-200">
      {/* Bot Avatar */}
      <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-amber-600 to-stone-800 text-amber-100 flex items-center justify-center shrink-0 shadow-xs">
        <CloudSun className="w-4 h-4 animate-pulse" />
      </div>

      {/* Typing Bubble */}
      <div className="bg-white rounded-2xl rounded-tl-xs px-4 py-3 border border-stone-200/90 shadow-xs max-w-[80%] space-y-1.5 text-stone-800">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-600 animate-bounce [animation-delay:-0.3s]"></span>
            <span className="w-2 h-2 rounded-full bg-amber-600 animate-bounce [animation-delay:-0.15s]"></span>
            <span className="w-2 h-2 rounded-full bg-amber-600 animate-bounce"></span>
          </div>
          <span className="text-xs font-semibold text-stone-800">
            Checking live Open-Meteo forecast for {locationName}...
          </span>
        </div>
        <p className="text-[11px] text-stone-500">
          Running <code className="font-mono bg-stone-100 text-amber-800 border border-stone-200 px-1 py-0.5 rounded text-[10px]">get_weather</code> tool to verify real rain & wind data
        </p>
      </div>
    </div>
  );
};
