import React, { useState, useEffect } from "react";
import { Search, MapPin, X, Navigation, Check, Loader2, Compass } from "lucide-react";
import { LocationItem } from "../types";
import { DEFAULT_LOCATIONS } from "../data/constants";

interface LocationModalProps {
  isOpen: boolean;
  activeLocation: LocationItem;
  onClose: () => void;
  onSelectLocation: (loc: LocationItem) => void;
}

export const LocationModal: React.FC<LocationModalProps> = ({
  isOpen,
  activeLocation,
  onClose,
  onSelectLocation,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<LocationItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    if (!searchTerm || searchTerm.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/locations?q=${encodeURIComponent(searchTerm.trim())}`
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
        }
      } catch (err) {
        console.error("Location search failed", err);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  if (!isOpen) return null;

  // Browser Geolocation
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }

    setIsLocating(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const reverseRes = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${latitude.toFixed(
              2
            )},${longitude.toFixed(2)}&count=1&language=en&format=json`
          );
          let detectedName = "My Location";
          let detectedAdmin1 = "";
          let detectedCountry = "India";

          if (reverseRes.ok) {
            const data = await reverseRes.json();
            if (data.results && data.results.length > 0) {
              detectedName = data.results[0].name;
              detectedAdmin1 = data.results[0].admin1 || "";
              detectedCountry = data.results[0].country || "India";
            }
          }

          const detectedLocation: LocationItem = {
            name: detectedName,
            admin1: detectedAdmin1,
            country: detectedCountry,
            latitude,
            longitude,
            timezone: "Asia/Kolkata",
          };

          onSelectLocation(detectedLocation);
          setIsLocating(false);
          onClose();
        } catch (err) {
          console.error("Reverse geocoding failed", err);
          onSelectLocation({
            name: "GPS Location",
            country: "India",
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            timezone: "Asia/Kolkata",
          });
          setIsLocating(false);
          onClose();
        }
      },
      (err) => {
        setIsLocating(false);
        setGeoError(
          err.code === 1
            ? "Location permission denied. Please select your city from the list."
            : "Could not retrieve your current location."
        );
      },
      { timeout: 10000 }
    );
  };

  return (
    <div
      id="location-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs transition-opacity"
      onClick={onClose}
    >
      <div
        id="location-modal-dialog"
        className="w-full max-w-md bg-gradient-to-b from-[#fdfcf9] via-[#faf7f0] to-[#f5f2eb] rounded-3xl shadow-2xl border border-stone-300/80 overflow-hidden text-stone-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-800 border border-amber-200">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-stone-900">
                Select Your Location
              </h3>
              <p className="text-[11px] text-stone-500">
                Ground forecasts & alerts for your region
              </p>
            </div>
          </div>
          <button
            id="btn-close-location-modal"
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-800 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="input-location-search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search city, district or mandal (e.g. Hyderabad, Kurnool)..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-stone-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500/25 focus:border-amber-600 transition-all bg-white text-stone-900 placeholder:text-stone-400 shadow-xs"
              autoFocus
            />
            {isSearching && (
              <Loader2 className="w-4 h-4 text-amber-700 absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin" />
            )}
          </div>

          {/* Current Location GPS Button */}
          <button
            id="btn-detect-gps"
            onClick={handleDetectLocation}
            disabled={isLocating}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl border border-amber-300 bg-amber-100/80 hover:bg-amber-200/80 text-amber-900 text-xs font-semibold transition-all cursor-pointer shadow-xs"
          >
            {isLocating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-800" />
                <span>Locating with GPS...</span>
              </>
            ) : (
              <>
                <Navigation className="w-3.5 h-3.5 text-amber-800" />
                <span>Use My Exact GPS Location</span>
              </>
            )}
          </button>

          {geoError && (
            <p className="text-xs text-rose-800 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
              {geoError}
            </p>
          )}

          {/* Search Results */}
          {searchResults.length > 0 ? (
            <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider px-1">
                Search Results
              </p>
              {searchResults.map((loc) => {
                const isSelected =
                  activeLocation.name === loc.name &&
                  activeLocation.admin1 === loc.admin1;
                return (
                  <button
                    key={`${loc.latitude}-${loc.longitude}`}
                    onClick={() => {
                      onSelectLocation(loc);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-sm transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-amber-100 border border-amber-300 text-amber-950 font-medium shadow-xs"
                        : "hover:bg-stone-100 text-stone-800"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <MapPin className="w-4 h-4 text-amber-700 shrink-0" />
                      <div>
                        <div className="font-semibold text-stone-900 leading-tight">
                          {loc.name}
                        </div>
                        <div className="text-xs text-stone-500">
                          {[loc.admin1, loc.country].filter(Boolean).join(", ")}
                        </div>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-amber-800 shrink-0" />}
                  </button>
                );
              })}
            </div>
          ) : searchTerm.trim().length >= 2 && !isSearching ? (
            <p className="text-xs text-stone-500 text-center py-3">
              No matching locations found for "{searchTerm}". Try a nearby city or district.
            </p>
          ) : (
            /* Popular Regional Hubs */
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider px-1">
                Popular Cities & Agrarian Hubs
              </p>
              <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {DEFAULT_LOCATIONS.map((loc) => {
                  const isSelected = activeLocation.name === loc.name;
                  return (
                    <button
                      key={loc.name}
                      onClick={() => {
                        onSelectLocation(loc);
                        onClose();
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-xl text-left text-xs transition-all border cursor-pointer ${
                        isSelected
                          ? "bg-amber-100 border-amber-300 text-amber-950 font-semibold shadow-xs"
                          : "bg-white hover:bg-stone-100 border-stone-200 text-stone-800"
                      }`}
                    >
                      <div className="truncate">
                        <div className="font-semibold text-stone-900 truncate">
                          {loc.name}
                        </div>
                        <div className="text-[10px] text-stone-500 truncate">
                          {loc.admin1}
                        </div>
                      </div>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-amber-800 shrink-0 ml-1" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
