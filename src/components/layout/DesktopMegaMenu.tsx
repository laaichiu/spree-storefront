"use client";

import type { Category } from "@spree/sdk";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DesktopMegaMenuPanel } from "@/components/layout/desktop-mega-menu/DesktopMegaMenuPanel";
import { categoryPathMatches } from "@/components/layout/desktop-mega-menu/model";
import { cn } from "@/lib/utils";

interface DesktopMegaMenuProps {
  rootCategories: Category[];
  basePath: string;
}

const MENU_CLOSE_DELAY_MS = 140;

const topLevelClass =
  "relative inline-flex h-16 items-center whitespace-nowrap text-sm font-medium text-gray-700 transition-colors after:absolute after:bottom-3 after:left-0 after:h-0.5 after:w-full after:origin-center after:scale-x-0 after:bg-current after:transition-transform after:duration-200 hover:text-gray-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2";

export function DesktopMegaMenu({
  rootCategories,
  basePath,
}: DesktopMegaMenuProps) {
  const pathname = usePathname();
  const t = useTranslations("header");
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef(new Map<string, HTMLAnchorElement>());
  const suppressFocusOpenRef = useRef(false);

  const activeCategory = useMemo(
    () =>
      rootCategories.find((category) => category.id === activeCategoryId) ??
      null,
    [activeCategoryId, rootCategories],
  );

  const currentCategoryId = useMemo(() => {
    const currentCategory = rootCategories.find((category) =>
      categoryPathMatches({ basePath, category, pathname }),
    );

    return currentCategory?.id ?? null;
  }, [basePath, pathname, rootCategories]);

  const closeCategory = useCallback(() => {
    setActiveCategoryId(null);
  }, []);

  const cancelScheduledClose = useCallback(() => {
    if (closeTimeoutRef.current !== null) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelScheduledClose();
    closeTimeoutRef.current = setTimeout(() => {
      closeTimeoutRef.current = null;
      closeCategory();
    }, MENU_CLOSE_DELAY_MS);
  }, [cancelScheduledClose, closeCategory]);

  const handleCategoryEnter = useCallback(
    (category: Category) => {
      if (suppressFocusOpenRef.current) {
        return;
      }

      if ((category.children?.length ?? 0) > 0) {
        setActiveCategoryId(category.id);
      } else {
        closeCategory();
      }
    },
    [closeCategory],
  );

  useEffect(() => {
    if (pathname) {
      closeCategory();
    }
  }, [closeCategory, pathname]);

  useEffect(() => {
    return () => cancelScheduledClose();
  }, [cancelScheduledClose]);

  useEffect(() => {
    if (!activeCategoryId) {
      return;
    }

    const openCategoryId = activeCategoryId;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      suppressFocusOpenRef.current = true;
      closeCategory();
      triggerRefs.current.get(openCategoryId)?.focus();
      window.setTimeout(() => {
        suppressFocusOpenRef.current = false;
      }, 0);
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        closeCategory();
      }
    }

    function handleFocusIn(event: FocusEvent) {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        closeCategory();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("focusin", handleFocusIn);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [activeCategoryId, closeCategory]);

  if (rootCategories.length === 0) {
    return null;
  }

  const activePanelId = activeCategory
    ? `desktop-mega-menu-panel-${activeCategory.id}`
    : undefined;

  return (
    <div ref={rootRef} className="hidden min-w-0 lg:block">
      <nav
        aria-label={t("categories")}
        className="flex h-16 min-w-0 items-stretch gap-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden xl:gap-7"
        onMouseEnter={cancelScheduledClose}
        onMouseLeave={scheduleClose}
        onPointerEnter={cancelScheduledClose}
        onPointerLeave={scheduleClose}
      >
        {rootCategories.map((category) => {
          const hasChildren = (category.children?.length ?? 0) > 0;
          const isOpen = activeCategoryId === category.id;
          const isCurrentCategory = currentCategoryId === category.id;
          const isActive = isOpen || isCurrentCategory;

          return (
            <Link
              key={category.id}
              ref={(node) => {
                if (node) {
                  triggerRefs.current.set(category.id, node);
                } else {
                  triggerRefs.current.delete(category.id);
                }
              }}
              href={`${basePath}/c/${category.permalink}`}
              aria-controls={hasChildren && isOpen ? activePanelId : undefined}
              aria-expanded={hasChildren ? isOpen : undefined}
              aria-haspopup={hasChildren ? "true" : undefined}
              aria-current={isCurrentCategory ? "page" : undefined}
              className={cn(
                topLevelClass,
                isActive && "after:scale-x-100 text-gray-950",
              )}
              onClick={closeCategory}
              onFocus={() => handleCategoryEnter(category)}
              onMouseEnter={() => handleCategoryEnter(category)}
              onPointerEnter={() => handleCategoryEnter(category)}
            >
              {category.name}
            </Link>
          );
        })}
      </nav>

      {activeCategory && activePanelId ? (
        <DesktopMegaMenuPanel
          activeCategory={activeCategory}
          activePanelId={activePanelId}
          basePath={basePath}
          pathname={pathname}
          onCancelScheduledClose={cancelScheduledClose}
          onClose={closeCategory}
          onScheduleClose={scheduleClose}
          panelRef={panelRef}
        />
      ) : null}
    </div>
  );
}
