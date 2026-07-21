"use client";

import { Search, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const SearchBar = dynamic(
  () =>
    import("@/components/search/SearchBar").then((mod) => ({
      default: mod.SearchBar,
    })),
  {
    loading: () => (
      <div className="h-10 w-full bg-gray-100 rounded-md animate-pulse" />
    ),
  },
);

interface SearchToggleProps {
  basePath: string;
  /** Left slot (desktop category navigation or mobile menu) */
  left: ReactNode;
  /** Center slot (e.g. logo) */
  center: ReactNode;
  /** Rendered before the search button in the right section */
  rightStart: ReactNode;
  /** Rendered after the search button in the right section */
  rightEnd: ReactNode;
}

export function SearchToggle({
  basePath,
  left,
  center,
  rightStart,
  rightEnd,
}: SearchToggleProps) {
  const t = useTranslations("header");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const navigationCloseTimeoutRef = useRef<number | null>(null);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    searchTriggerRef.current?.focus();
  }, []);

  useEffect(() => {
    return () => {
      if (navigationCloseTimeoutRef.current) {
        clearTimeout(navigationCloseTimeoutRef.current);
      }
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 h-16">
      {/* This white layer masks the search drawer while it slides down. */}
      <div
        className="relative z-30 h-full border-b border-gray-300 bg-white"
        onPointerDownCapture={(event) => {
          if (!searchOpen) return;
          const target = event.target;
          if (
            target instanceof Element &&
            target.closest("[data-search-trigger]")
          ) {
            return;
          }
          if (navigationCloseTimeoutRef.current) {
            clearTimeout(navigationCloseTimeoutRef.current);
          }
          navigationCloseTimeoutRef.current = window.setTimeout(() => {
            navigationCloseTimeoutRef.current = null;
            setSearchOpen(false);
          }, 0);
        }}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex items-center h-full w-full">
            {/* Left section */}
            <div className="flex min-w-0 items-center flex-1">{left}</div>

            {/* Center section */}
            <div className="flex justify-center min-w-0">{center}</div>

            {/* Right section */}
            <div className="flex items-center flex-1 justify-end space-x-2">
              <div className="contents">{rightStart}</div>

              {/* Search toggle */}
              <Button
                ref={searchTriggerRef}
                data-search-trigger
                variant="ghost"
                size="icon-lg"
                onClick={() => {
                  if (searchOpen) {
                    closeSearch();
                  } else {
                    setSearchOpen(true);
                  }
                }}
                aria-label={searchOpen ? t("closeSearch") : t("openSearch")}
                aria-expanded={searchOpen}
                aria-controls="header-search"
              >
                <Search className="size-5" />
              </Button>

              <div className="contents">{rightEnd}</div>
            </div>
          </div>
        </div>
      </div>

      {/* The scrim begins below the search bar, leaving navigation visible. */}
      <button
        type="button"
        tabIndex={-1}
        aria-label={t("closeSearch")}
        aria-hidden={!searchOpen}
        onClick={closeSearch}
        className={`fixed inset-x-0 bottom-0 top-16 z-10 bg-black/50 transition-opacity duration-300 motion-reduce:transition-none ${
          searchOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Search bar drawer */}
      <div
        id="header-search"
        role="dialog"
        aria-label={t("openSearch")}
        aria-hidden={!searchOpen}
        inert={!searchOpen}
        onKeyDown={(e) => {
          if (e.key === "Escape") closeSearch();
        }}
        className={`absolute inset-x-0 top-full z-20 h-16 border-b border-gray-300 bg-white will-change-transform transition-transform duration-300 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          searchOpen ? "translate-y-0" : "pointer-events-none -translate-y-full"
        }`}
      >
        <div className="container mx-auto flex h-full items-center gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex-1">
            <SearchBar
              basePath={basePath}
              autoFocus={searchOpen}
              onNavigate={closeSearch}
            />
          </div>
          <Button
            variant="ghost"
            size="icon-lg"
            onClick={closeSearch}
            aria-label={t("closeSearch")}
          >
            <X className="size-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
