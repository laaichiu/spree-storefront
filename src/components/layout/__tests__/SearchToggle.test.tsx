import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchToggle } from "@/components/layout/SearchToggle";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/dynamic", () => ({
  default: () => {
    function MockSearchBar(): ReactElement {
      return <input aria-label="mock search" />;
    }
    return MockSearchBar;
  },
}));

function renderSearchToggle(onNavigation = vi.fn()): ReturnType<typeof render> {
  return render(
    <SearchToggle
      basePath="/us/en"
      left={<button onClick={onNavigation}>Navigation</button>}
      center={<span>Logo</span>}
      rightStart={<span>Country</span>}
      rightEnd={<span>Cart</span>}
    />,
  );
}

describe("SearchToggle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("updates the search trigger name to match its action", () => {
    renderSearchToggle();
    const trigger = screen.getByRole("button", { name: "openSearch" });

    fireEvent.click(trigger);

    expect(trigger).toHaveAccessibleName("closeSearch");
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(trigger);

    expect(trigger).toHaveAccessibleName("openSearch");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("closes search without blocking the selected navigation action", () => {
    const onNavigation = vi.fn();
    renderSearchToggle(onNavigation);
    const trigger = screen.getByRole("button", { name: "openSearch" });
    const navigation = screen.getByRole("button", { name: "Navigation" });

    fireEvent.click(trigger);
    fireEvent.pointerDown(navigation);
    fireEvent.click(navigation);
    act(() => vi.runAllTimers());

    expect(onNavigation).toHaveBeenCalledOnce();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
