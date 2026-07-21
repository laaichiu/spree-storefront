import type { Category } from "@spree/sdk";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DesktopMegaMenu } from "@/components/layout/DesktopMegaMenu";
import {
  categoryPathEquals,
  categoryPathMatches,
} from "@/components/layout/desktop-mega-menu/model";

const navigationState = vi.hoisted(() => ({ pathname: "/us/en" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
}));

vi.mock("next-intl", () => ({
  useTranslations:
    () =>
    (key: string, values?: Record<string, string>): string => {
      if (key === "allCategory") {
        return `All ${values?.category}`;
      }

      return key;
    },
}));

interface CategoryOptions {
  id: string;
  name: string;
  permalink: string;
  children?: Category[];
  imageUrl?: string | null;
}

function createCategory({
  id,
  name,
  permalink,
  children = [],
  imageUrl = null,
}: CategoryOptions): Category {
  return {
    id,
    name,
    permalink,
    position: 0,
    depth: permalink.split("/").length - 1,
    meta_title: null,
    meta_description: null,
    meta_keywords: null,
    children_count: children.length,
    parent_id: null,
    description: "",
    description_html: "",
    image_url: imageUrl,
    square_image_url: null,
    is_root: !permalink.includes("/"),
    is_child: permalink.includes("/"),
    is_leaf: children.length === 0,
    children,
  };
}

const kitchen = createCategory({
  id: "kitchen",
  name: "Kitchen",
  permalink: "kitchen",
  children: [
    createCategory({
      id: "coffee",
      name: "Coffee Machines",
      permalink: "kitchen/coffee-machines",
    }),
    createCategory({
      id: "appliances",
      name: "Appliances",
      permalink: "kitchen/appliances",
      children: [
        createCategory({
          id: "blenders",
          name: "Blenders",
          permalink: "kitchen/appliances/blenders",
        }),
        createCategory({
          id: "toasters",
          name: "Toasters",
          permalink: "kitchen/appliances/toasters",
        }),
      ],
    }),
  ],
});

const air = createCategory({
  id: "air",
  name: "Air & Climate",
  permalink: "air-and-climate",
  children: [
    createCategory({
      id: "purifiers",
      name: "Air Purifiers",
      permalink: "air-and-climate/air-purifiers",
    }),
  ],
});

const accessories = createCategory({
  id: "accessories",
  name: "Accessories",
  permalink: "accessories",
});

const rootCategories = [kitchen, air, accessories];

function renderMenu(categories = rootCategories): ReturnType<typeof render> {
  return render(
    <>
      <DesktopMegaMenu rootCategories={categories} basePath="/us/en" />
      <button type="button">Outside control</button>
    </>,
  );
}

describe("DesktopMegaMenu", () => {
  beforeEach(() => {
    navigationState.pathname = "/us/en";
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("renders nothing without root categories", () => {
    renderMenu([]);

    expect(
      screen.queryByRole("navigation", { name: "categories" }),
    ).not.toBeInTheDocument();
  });

  it("opens on pointer entry and closes after the pointer delay", () => {
    vi.useFakeTimers();
    renderMenu();
    const trigger = screen.getByRole("link", { name: "Kitchen" });
    const navigation = screen.getByRole("navigation", { name: "categories" });

    fireEvent.pointerEnter(trigger);
    expect(screen.getByRole("region", { name: "Kitchen" })).toBeInTheDocument();

    fireEvent.pointerLeave(navigation);
    act(() => vi.advanceTimersByTime(139));
    expect(screen.getByRole("region", { name: "Kitchen" })).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    expect(
      screen.queryByRole("region", { name: "Kitchen" }),
    ).not.toBeInTheDocument();
  });

  it("routes keyboard focus through the panel and restores it on Escape", () => {
    renderMenu();
    const kitchenTrigger = screen.getByRole("link", { name: "Kitchen" });
    const airTrigger = screen.getByRole("link", { name: "Air & Climate" });

    kitchenTrigger.focus();
    fireEvent.keyDown(kitchenTrigger, { key: "Tab" });

    const firstKitchenLink = screen.getByRole("link", {
      name: "All Kitchen",
    });
    expect(firstKitchenLink).toHaveFocus();

    fireEvent.keyDown(firstKitchenLink, { key: "Tab", shiftKey: true });
    expect(kitchenTrigger).toHaveFocus();

    fireEvent.keyDown(kitchenTrigger, { key: "ArrowDown" });
    const kitchenPanelLinks = screen
      .getByRole("region", { name: "Kitchen" })
      .querySelectorAll<HTMLAnchorElement>("a[href]");
    const lastKitchenLink = kitchenPanelLinks.item(
      kitchenPanelLinks.length - 1,
    );

    lastKitchenLink.focus();
    fireEvent.keyDown(lastKitchenLink, { key: "Tab" });
    expect(airTrigger).toHaveFocus();
    expect(airTrigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(airTrigger, { key: "ArrowDown" });
    expect(
      screen.getByRole("link", { name: "All Air & Climate" }),
    ).toHaveFocus();

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Escape" });
    expect(airTrigger).toHaveFocus();
    expect(airTrigger).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("region", { name: "Air & Climate" }),
    ).not.toBeInTheDocument();
  });

  it("moves focus past the menu after the final panel link", () => {
    renderMenu([air]);
    const trigger = screen.getByRole("link", { name: "Air & Climate" });
    const outsideControl = screen.getByRole("button", {
      name: "Outside control",
    });
    vi.spyOn(outsideControl, "getClientRects").mockReturnValue([
      {} as DOMRect,
    ] as unknown as DOMRectList);

    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const finalPanelLink = screen.getByRole("link", { name: "Air Purifiers" });

    finalPanelLink.focus();
    fireEvent.keyDown(finalPanelLink, { key: "Tab" });

    expect(outsideControl).toHaveFocus();
    expect(
      screen.queryByRole("region", { name: "Air & Climate" }),
    ).not.toBeInTheDocument();
  });

  it("restores focus to the owning trigger after a child category navigation", () => {
    const { rerender } = renderMenu();
    const kitchenTrigger = screen.getByRole("link", { name: "Kitchen" });

    kitchenTrigger.focus();
    fireEvent.keyDown(kitchenTrigger, { key: "ArrowDown" });
    const childLink = screen.getByRole("link", { name: "Coffee Machines" });
    childLink.addEventListener("click", (event) => event.preventDefault(), {
      once: true,
    });
    fireEvent.click(childLink);

    navigationState.pathname = "/us/en/c/kitchen/coffee-machines";
    rerender(
      <>
        <DesktopMegaMenu rootCategories={rootCategories} basePath="/us/en" />
        <button type="button">Outside control</button>
      </>,
    );

    expect(kitchenTrigger).toHaveFocus();
    expect(
      screen.queryByRole("region", { name: "Kitchen" }),
    ).not.toBeInTheDocument();

    fireEvent.keyDown(kitchenTrigger, { key: "Tab" });
    expect(screen.getByRole("link", { name: "Coffee Machines" })).toHaveFocus();
  });

  it("does not close on pointer leave while focus remains in the panel", () => {
    vi.useFakeTimers();
    renderMenu();
    const trigger = screen.getByRole("link", { name: "Kitchen" });

    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const panel = screen.getByRole("region", { name: "Kitchen" });
    expect(screen.getByRole("link", { name: "All Kitchen" })).toHaveFocus();

    fireEvent.pointerLeave(panel);
    act(() => vi.advanceTimersByTime(140));

    expect(panel).toBeInTheDocument();
  });

  it("closes when focus or pointer moves outside the menu", () => {
    renderMenu();
    const trigger = screen.getByRole("link", { name: "Kitchen" });
    const outsideControl = screen.getByRole("button", {
      name: "Outside control",
    });

    fireEvent.pointerEnter(trigger);
    fireEvent.pointerDown(outsideControl);
    expect(
      screen.queryByRole("region", { name: "Kitchen" }),
    ).not.toBeInTheDocument();

    fireEvent.pointerEnter(trigger);
    act(() => outsideControl.focus());
    expect(
      screen.queryByRole("region", { name: "Kitchen" }),
    ).not.toBeInTheDocument();
  });

  it("constrains tall panels and uses the optimized category image", () => {
    const imageCategory = createCategory({
      ...kitchen,
      imageUrl: "https://example.com/kitchen.jpg",
    });
    renderMenu([imageCategory]);

    fireEvent.pointerEnter(screen.getByRole("link", { name: "Kitchen" }));
    const panel = screen.getByRole("region", { name: "Kitchen" });
    const image = panel.querySelector("img");

    expect(panel).toHaveClass("max-h-[calc(100dvh-4rem)]", "overflow-y-auto");
    expect(image).toHaveAttribute("src", "https://example.com/kitchen.jpg");
    expect(image).toHaveAttribute("alt", "");
    expect(image).toHaveClass("object-cover");
  });

  it("uses exact current-page semantics and closes after a route change", () => {
    navigationState.pathname = "/us/en/c/kitchen/appliances/toasters";
    const { rerender } = renderMenu();
    const trigger = screen.getByRole("link", { name: "Kitchen" });

    expect(trigger).toHaveAttribute("aria-current", "location");
    fireEvent.pointerEnter(trigger);
    expect(screen.getByRole("region", { name: "Kitchen" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Appliances" }),
    ).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Toasters" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    navigationState.pathname = "/us/en/products";
    rerender(
      <>
        <DesktopMegaMenu rootCategories={rootCategories} basePath="/us/en" />
        <button type="button">Outside control</button>
      </>,
    );

    expect(
      screen.queryByRole("region", { name: "Kitchen" }),
    ).not.toBeInTheDocument();
  });
});

describe("desktop mega menu path matching", () => {
  it("matches exact and descendant category paths without prefix collisions", () => {
    expect(
      categoryPathMatches({
        basePath: "/us/en",
        category: kitchen,
        pathname: "/us/en/c/kitchen",
      }),
    ).toBe(true);
    expect(
      categoryPathMatches({
        basePath: "/us/en",
        category: kitchen,
        pathname: "/us/en/c/kitchen/coffee-machines",
      }),
    ).toBe(true);
    expect(
      categoryPathMatches({
        basePath: "/us/en",
        category: kitchen,
        pathname: "/us/en/c/kitchenware",
      }),
    ).toBe(false);
    expect(
      categoryPathEquals({
        basePath: "/us/en",
        category: kitchen,
        pathname: "/us/en/c/kitchen/coffee-machines",
      }),
    ).toBe(false);
  });
});
