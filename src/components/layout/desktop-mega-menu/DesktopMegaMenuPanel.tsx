"use client";

import type { Category } from "@spree/sdk";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { RefObject } from "react";
import { createPortal } from "react-dom";
import {
  categoryPathEquals,
  categoryPathMatches,
} from "@/components/layout/desktop-mega-menu/model";
import { cn } from "@/lib/utils";

interface DesktopMegaMenuPanelProps {
  activeCategory: Category;
  activePanelId: string;
  basePath: string;
  pathname: string;
  onCancelScheduledClose: () => void;
  onClose: () => void;
  onScheduleClose: () => void;
  panelRef: RefObject<HTMLDivElement | null>;
}

const panelLinkClass =
  "relative block w-fit max-w-full text-sm text-gray-700 transition-colors after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:origin-center after:scale-x-0 after:bg-current after:transition-transform after:duration-200 hover:text-gray-950 hover:after:scale-x-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2";

function getCategoryHref(basePath: string, category: Category) {
  return `${basePath}/c/${category.permalink}`;
}

export function DesktopMegaMenuPanel({
  activeCategory,
  activePanelId,
  basePath,
  pathname,
  onCancelScheduledClose,
  onClose,
  onScheduleClose,
  panelRef,
}: DesktopMegaMenuPanelProps) {
  const t = useTranslations("header");

  if (typeof document === "undefined") {
    return null;
  }

  const children = activeCategory.children ?? [];
  const isActiveCategory = categoryPathEquals({
    basePath,
    category: activeCategory,
    pathname,
  });
  const hasNestedChildren = children.some(
    (child) => (child.children?.length ?? 0) > 0,
  );

  return createPortal(
    <>
      <button
        type="button"
        tabIndex={-1}
        aria-label={t("closeMenu")}
        className="fixed inset-x-0 top-16 bottom-0 z-40 cursor-default bg-black/20 max-lg:hidden"
        onClick={onClose}
      />
      <section
        ref={panelRef}
        id={activePanelId}
        aria-label={activeCategory.name}
        className="fixed inset-x-0 top-16 z-50 border-b border-gray-200 bg-white shadow-lg max-lg:hidden"
        onMouseEnter={onCancelScheduledClose}
        onMouseLeave={onScheduleClose}
        onPointerEnter={onCancelScheduledClose}
        onPointerLeave={onScheduleClose}
      >
        <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <div
            className={cn(
              "grid items-start gap-8",
              activeCategory.image_url
                ? "lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-12"
                : "grid-cols-1",
            )}
          >
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
                {activeCategory.name}
              </p>

              <nav
                aria-label={activeCategory.name}
                className={cn(
                  "mt-5 grid gap-x-10 gap-y-5",
                  hasNestedChildren ? "sm:grid-cols-2" : "grid-cols-1",
                )}
              >
                <Link
                  href={getCategoryHref(basePath, activeCategory)}
                  onClick={onClose}
                  aria-current={isActiveCategory ? "page" : undefined}
                  className={cn(
                    panelLinkClass,
                    isActiveCategory && "after:scale-x-100 text-gray-950",
                  )}
                >
                  {t("allCategory", { category: activeCategory.name })}
                </Link>

                {children.map((child) => {
                  const grandchildren = child.children ?? [];

                  if (grandchildren.length === 0) {
                    const isCurrentCategory = categoryPathMatches({
                      basePath,
                      category: child,
                      pathname,
                    });

                    return (
                      <Link
                        key={child.id}
                        href={getCategoryHref(basePath, child)}
                        onClick={onClose}
                        aria-current={isCurrentCategory ? "page" : undefined}
                        className={cn(
                          panelLinkClass,
                          isCurrentCategory &&
                            "after:scale-x-100 text-gray-950",
                        )}
                      >
                        {child.name}
                      </Link>
                    );
                  }

                  const isCurrentCategory = categoryPathMatches({
                    basePath,
                    category: child,
                    pathname,
                  });

                  return (
                    <div key={child.id} className="space-y-2">
                      <Link
                        href={getCategoryHref(basePath, child)}
                        onClick={onClose}
                        aria-current={isCurrentCategory ? "page" : undefined}
                        className={cn(
                          panelLinkClass,
                          "font-semibold text-gray-950",
                          isCurrentCategory && "after:scale-x-100",
                        )}
                      >
                        {child.name}
                      </Link>
                      <div className="space-y-2 border-l border-gray-200 pl-3">
                        {grandchildren.map((grandchild) => {
                          const isCurrentGrandchild = categoryPathMatches({
                            basePath,
                            category: grandchild,
                            pathname,
                          });

                          return (
                            <Link
                              key={grandchild.id}
                              href={getCategoryHref(basePath, grandchild)}
                              onClick={onClose}
                              aria-current={
                                isCurrentGrandchild ? "page" : undefined
                              }
                              className={cn(
                                panelLinkClass,
                                "text-gray-600",
                                isCurrentGrandchild &&
                                  "after:scale-x-100 text-gray-950",
                              )}
                            >
                              {grandchild.name}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </nav>
            </div>

            {activeCategory.image_url ? (
              <Link
                href={getCategoryHref(basePath, activeCategory)}
                onClick={onClose}
                className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
              >
                <div
                  className="aspect-[4/3] w-full overflow-hidden bg-gray-100 bg-cover bg-center transition-transform duration-500 group-hover:scale-[1.02]"
                  style={{
                    backgroundImage: `url(${activeCategory.image_url})`,
                  }}
                />
                <p className="pt-3 text-sm text-gray-700">
                  {t("allCategory", { category: activeCategory.name })}
                </p>
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </>,
    document.body,
  );
}
