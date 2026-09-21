import React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ShieldAlert,
  PhoneCall,
  MapPin,
  Radio,
  Clock,
  Sparkles,
  ExternalLink,
  X,
  AlertTriangle,
  Building2,
  Cpu,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

interface TgicccModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: "en" | "te";
  onAskQuery: (query: string) => void;
}

export const TgicccModal: React.FC<TgicccModalProps> = ({
  isOpen,
  onClose,
  language,
  onAskQuery,
}) => {
  if (!isOpen) return null;

  const isTelugu = language === "te";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-stone-950/60 backdrop-blur-xs"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-gradient-to-b from-[#fdfcf9] via-[#faf7f0] to-[#f5f2eb] border border-stone-300/80 text-stone-900 shadow-2xl z-10 p-5 sm:p-7"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-stone-200/90">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-rose-600 via-amber-600 to-stone-800 p-0.5 shadow-md flex items-center justify-center">
                <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center text-rose-700">
                  <Building2 className="w-6 h-6" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-bold text-stone-900 tracking-tight">
                    {isTelugu
                      ? "తెలంగాణ కమాండ్ & కంట్రోల్ సెంటర్ (TGICCC)"
                      : "Telangana Integrated Command and Control Centre"}
                  </h2>
                  <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    24/7 Active Hub
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  {isTelugu
                    ? "రాష్ట్ర మల్టీ-ఏజెన్సీ విపత్తు నిర్వహణ & అత్యవసర కేంద్రం"
                    : "State Multi-Agency Disaster Management & Emergency Operations Hub"}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-stone-400 hover:text-stone-800 hover:bg-stone-100 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Helplines Section */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Primary Helpline 112 */}
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 relative overflow-hidden group shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-rose-700">
                  <Radio className="w-4 h-4 animate-pulse" />
                  <span className="text-xs font-bold tracking-wider uppercase">
                    Unified Emergency Helpline
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-semibold border border-rose-200">
                  Toll-Free 24x7
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <a
                  href="tel:112"
                  className="text-3xl font-extrabold text-rose-900 tracking-tight hover:text-rose-700 transition-colors"
                >
                  Dial 112
                </a>
                <span className="text-xs text-stone-600">
                  (Police • Fire • Ambulance • Disaster)
                </span>
              </div>
              <p className="text-[11px] text-stone-600 mt-1">
                Integrated Emergency Response Support System (TGERSS) operated directly from TGICCC.
              </p>
            </div>

            {/* TGICCC Control Room Desk */}
            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-300 relative overflow-hidden shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-800">
                  <PhoneCall className="w-4 h-4" />
                  <span className="text-xs font-bold tracking-wider uppercase">
                    TGICCC Control Desk
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-semibold border border-amber-200">
                  Hyderabad Hub
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <a
                  href="tel:04023261166"
                  className="text-2xl font-bold text-stone-900 tracking-tight hover:text-amber-800 transition-colors"
                >
                  040-23261166
                </a>
              </div>
              <p className="text-[11px] text-stone-600 mt-1">
                Direct landline connection to the TGICCC headquarters operation center.
              </p>
            </div>
          </div>

          {/* Location & Facility Information */}
          <div className="mt-4 p-4 rounded-2xl bg-white border border-stone-200 shadow-xs space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-100 text-amber-800 border border-amber-200 shrink-0 mt-0.5">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="text-xs space-y-1">
                <span className="font-semibold text-stone-900 block">
                  Headquarters & Disaster Operations Center Address:
                </span>
                <p className="text-stone-700 leading-relaxed">
                  9th & 10th Floors, Telangana Integrated Command and Control Centre (TGICCC), Road No. 12, adjacent to Puri Jagannath Temple, Bhavani Nagar, Banjara Hills, Hyderabad, Telangana — 500034.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-stone-200 flex items-center justify-between flex-wrap gap-2 text-xs text-stone-500">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-emerald-700" />
                <span>Round-the-clock 24/7 Operations</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-700" />
                <span>Wheelchair-Accessible Facility</span>
              </div>
            </div>
          </div>

          {/* Integrated Agencies & Technological Capabilities */}
          <div className="mt-4 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-amber-800" />
              Integrated Multi-Agency Disaster Capabilities
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-xl bg-white border border-stone-200 shadow-xs space-y-1">
                <span className="font-semibold text-stone-900 block">
                  🌧️ GHMC & Monsoon Flood Monitoring
                </span>
                <p className="text-[11px] text-stone-600 leading-relaxed">
                  Real-time waterlogging surveillance across low-lying zones, nalas, and traffic junctions with emergency desilting teams.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-white border border-stone-200 shadow-xs space-y-1">
                <span className="font-semibold text-stone-900 block">
                  🤖 AI Emergency Response (Dial 112)
                </span>
                <p className="text-[11px] text-stone-600 leading-relaxed">
                  AI-driven distress sound detection, automated service dispatch, and caller GPS geo-pinpointing in ~6-10 minutes.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-white border border-stone-200 shadow-xs space-y-1">
                <span className="font-semibold text-stone-900 block">
                  📡 SDRF & NDRF Coordinated Relief
                </span>
                <p className="text-[11px] text-stone-600 leading-relaxed">
                  Direct dispatch of State Disaster Response Force, rescue boats, and high-capacity dewatering pumps.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-white border border-stone-200 shadow-xs space-y-1">
                <span className="font-semibold text-stone-900 block">
                  🚁 Drone & Aerial Surveillance
                </span>
                <p className="text-[11px] text-stone-600 leading-relaxed">
                  Integrated thermal and aerial camera feeds to inspect reservoir embankments and water levels during severe downpours.
                </p>
              </div>
            </div>
          </div>

          {/* WeatherGPT Guided Actions */}
          <div className="mt-5 pt-4 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-stone-600">
              Need immediate weather guidance for Hyderabad or Telangana?
            </span>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => {
                  onClose();
                  onAskQuery(
                    isTelugu
                      ? "TGICCC మార్గదర్శకాల ప్రకారం భారీ వర్షాలు లేదా వరదల సమయంలో తీసుకోవలసిన భద్రతా జాగ్రత్తలు ఏమిటి?"
                      : "What are the recommended safety precautions during heavy rains or urban waterlogging according to TGICCC disaster advisories?"
                  );
                }}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-800 to-stone-800 hover:from-amber-700 hover:to-stone-700 text-white shadow-xs transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                <span>Ask Safety Precautions</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
