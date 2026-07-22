"use client";

import type { Category } from "@spree/sdk";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DesktopMegaMenuPanel } from "@/components/layout/desktop-mega-menu/DesktopMegaMenuPanel";
import {
  categoryPathEquals,
  categoryPathMatches,
} from "@/components/layout/desktop-mega-menu/model";
import { cn } from "@/lib/utils";

interface DesktopMegaMenuProps {
  rootCategories: Category[];
  basePath: string;
}

const MENU_CLOSE_DELAY_MS = 140;
const PANEL_LINK_SELECTOR = "a[href]";
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const topLevelClass =
  "inline-flex h-16 items-center whitespace-nowrap text-sm font-medium text-gray-700 transition-colors hover:text-gray-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2";
const topLevelLabelClass =
  "relative inline-block after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:origin-right after:scale-x-0 after:bg-current after:transition-transform after:duration-500 after:ease-in-out motion-reduce:after:transition-none";

function findPreferredPanelLink(
  panel: HTMLElement | null,
  pathname: string,
): HTMLAnchorElement | undefined {
  const panelLinks = Array.from(
    panel?.querySelectorAll<HTMLAnchorElement>(PANEL_LINK_SELECTOR) ?? [],
  );

  return (
    panelLinks.find((link) => link.getAttribute("href") === pathname) ??
    panelLinks.at(0)
  );
}

export function DesktopMegaMenu({
  rootCategories,
  basePath,
}: DesktopMegaMenuProps): React.JSX.Element | null {
  const pathname = usePathname();
  const t = useTranslations("header");
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const triggerRefs = useRef(new Map<string, HTMLAnchorElement>());
  const suppressFocusOpenRef = useRef(false);
  const pendingPanelFocusRef = useRef(false);

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

  const closeCategory = useCallback((): void => {
    pendingPanelFocusRef.current = false;
    setActiveCategoryId(null);
  }, []);

  const focusCategoryTrigger = useCallback((categoryId: string): void => {
    suppressFocusOpenRef.current = true;
    triggerRefs.current.get(categoryId)?.focus();
    suppressFocusOpenRef.current = false;
  }, []);

  const cancelScheduledClose = useCallback((): void => {
    if (closeTimeoutRef.current !== null) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback((): void => {
    cancelScheduledClose();
    closeTimeoutRef.current = setTimeout(() => {
      closeTimeoutRef.current = null;

      const activeElement = document.activeElement;
      if (
        activeElement &&
        (rootRef.current?.contains(activeElement) ||
          panelRef.current?.contains(activeElement))
      ) {
        return;
      }

      closeCategory();
    }, MENU_CLOSE_DELAY_MS);
  }, [cancelScheduledClose, closeCategory]);

  const handleCategoryEnter = useCallback(
    (category: Category): void => {
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

  const focusPreferredPanelLink = useCallback(
    (category: Category): void => {
      cancelScheduledClose();

      if (activeCategoryId === category.id) {
        const preferredLink = findPreferredPanelLink(
          panelRef.current,
          pathname,
        );

        if (preferredLink) {
          preferredLink.focus();
          return;
        }
      }

      pendingPanelFocusRef.current = true;
      setActiveCategoryId(category.id);
    },
    [activeCategoryId, cancelScheduledClose, pathname],
  );

  const focusNextHeaderControl = useCallback(
    (categoryId: string): void => {
      const categoryIndex = rootCategories.findIndex(
        (category) => category.id === categoryId,
      );
      const nextCategory = rootCategories[categoryIndex + 1];

      if (nextCategory) {
        triggerRefs.current.get(nextCategory.id)?.focus();
        return;
      }

      const currentTrigger = triggerRefs.current.get(categoryId);
      if (!currentTrigger) {
        return;
      }

      const focusableElements = Array.from(
        document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      const currentIndex = focusableElements.indexOf(currentTrigger);
      const nextControl = focusableElements
        .slice(currentIndex + 1)
        .find(
          (element) =>
            !rootRef.current?.contains(element) &&
            !panelRef.current?.contains(element) &&
            !element.closest("[inert]") &&
            element.getClientRects().length > 0,
        );

      nextControl?.focus();
    },
    [rootCategories],
  );

  const handlePanelNavigate = useCallback((): void => {
    if (!activeCategoryId) {
      return;
    }

    cancelScheduledClose();
    if (activeCategoryId === currentCategoryId) {
      closeCategory();
    }
    focusCategoryTrigger(activeCategoryId);
  }, [
    activeCategoryId,
    cancelScheduledClose,
    closeCategory,
    currentCategoryId,
    focusCategoryTrigger,
  ]);

  useEffect(() => {
    if (!activeCategoryId || !pendingPanelFocusRef.current) {
      return;
    }

    const preferredLink = findPreferredPanelLink(panelRef.current, pathname);

    if (preferredLink) {
      pendingPanelFocusRef.current = false;
      preferredLink.focus();
    }
  }, [activeCategoryId, pathname]);

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

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelScheduledClose();
        closeCategory();
        focusCategoryTrigger(openCategoryId);
        return;
      }

      if (
        event.key !== "Tab" ||
        !panelRef.current?.contains(event.target as Node)
      ) {
        return;
      }

      const panelLinks = Array.from(
        panelRef.current.querySelectorAll<HTMLAnchorElement>(
          PANEL_LINK_SELECTOR,
        ),
      );
      const firstLink = panelLinks[0];
      const lastLink = panelLinks.at(-1);

      if (event.shiftKey && event.target === firstLink) {
        event.preventDefault();
        triggerRefs.current.get(openCategoryId)?.focus();
      } else if (!event.shiftKey && event.target === lastLink) {
        event.preventDefault();
        focusNextHeaderControl(openCategoryId);
      }
    }

    function handlePointerDown(event: PointerEvent): void {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        closeCategory();
      }
    }

    function handleFocusIn(event: FocusEvent): void {
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
  }, [
    activeCategoryId,
    cancelScheduledClose,
    closeCategory,
    focusCategoryTrigger,
    focusNextHeaderControl,
  ]);

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
        onPointerEnter={cancelScheduledClose}
        onPointerLeave={scheduleClose}
      >
        {rootCategories.map((category) => {
          const hasChildren = (category.children?.length ?? 0) > 0;
          const isOpen = activeCategoryId === category.id;
          const isCurrentCategory = currentCategoryId === category.id;
          const isExactCurrentCategory = categoryPathEquals({
            basePath,
            category,
            pathname,
          });
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
              aria-current={
                isExactCurrentCategory
                  ? "page"
                  : isCurrentCategory
                    ? "location"
                    : undefined
              }
              className={cn(topLevelClass, isActive && "text-gray-950")}
              onClick={isCurrentCategory ? closeCategory : undefined}
              onFocus={() => handleCategoryEnter(category)}
              onKeyDown={(event) => {
                if (
                  hasChildren &&
                  (event.key === "ArrowDown" ||
                    (event.key === "Tab" && !event.shiftKey))
                ) {
                  event.preventDefault();
                  focusPreferredPanelLink(category);
                }
              }}
              onPointerEnter={() => handleCategoryEnter(category)}
            >
              <span
                className={cn(
                  topLevelLabelClass,
                  isActive && "after:origin-left after:scale-x-100",
                )}
              >
                {category.name}
              </span>
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
          onNavigate={handlePanelNavigate}
          onScheduleClose={scheduleClose}
          panelRef={panelRef}
        />
      ) : null}
    </div>
  );
}
