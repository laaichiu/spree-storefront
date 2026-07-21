import type { Product } from "@spree/sdk";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchBar } from "@/components/search/SearchBar";

const { mockGetProducts, mockPush, mockTrackQuickSearch, mockTrackSelectItem } =
  vi.hoisted(() => ({
    mockGetProducts: vi.fn(),
    mockPush: vi.fn(),
    mockTrackQuickSearch: vi.fn(),
    mockTrackSelectItem: vi.fn(),
  }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("next/link", () => ({
  default: ({ onClick, ...props }: ComponentProps<"a">) => (
    <a
      {...props}
      // biome-ignore lint/a11y/useValidAnchor: Keep link semantics without triggering jsdom navigation.
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
    />
  ),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: { query?: string }) =>
    values?.query ? `${key}:${values.query}` : key,
}));

vi.mock("@/contexts/StoreContext", () => ({
  useStore: () => ({ currency: "USD" }),
}));

vi.mock("@/lib/data/products", () => ({
  getProducts: mockGetProducts,
}));

vi.mock("@/lib/analytics/gtm", () => ({
  trackQuickSearch: mockTrackQuickSearch,
  trackSelectItem: mockTrackSelectItem,
}));

vi.mock("@/components/ui/product-image", () => ({
  ProductImage: () => <span data-testid="product-image" />,
}));

const airFryer = {
  id: "product-air-fryer",
  name: "Digital Air Fryer",
  slug: "digital-air-fryer",
  thumbnail_url: null,
  price: { display_amount: "$119.99" },
} as unknown as Product;

const airPurifier = {
  id: "product-air-purifier",
  name: "Air Purifier",
  slug: "air-purifier",
  thumbnail_url: null,
  price: { display_amount: "$149.99" },
} as unknown as Product;

function response(products: Product[]): never {
  return { data: products } as never;
}

async function advanceSearchDebounce(): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(300);
    await Promise.resolve();
  });
}

describe("SearchBar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockGetProducts.mockResolvedValue(response([airFryer]));
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("shows a searching state during the debounce instead of a false empty state", async () => {
    render(<SearchBar basePath="/us/en" />);
    const input = screen.getByRole("combobox", { name: "search" });

    fireEvent.change(input, { target: { value: "air" } });

    expect(screen.getByText("searching")).toBeInTheDocument();
    expect(screen.queryByText("noProductsFound")).not.toBeInTheDocument();

    await advanceSearchDebounce();

    expect(screen.getByText("Digital Air Fryer")).toBeInTheDocument();
    expect(screen.queryByText("searching")).not.toBeInTheDocument();
  });

  it("preserves the query and suggestions when closed and reopened", async () => {
    const { rerender } = render(
      <SearchBar basePath="/us/en" autoFocus={true} />,
    );
    const input = screen.getByRole("combobox", { name: "search" });

    fireEvent.change(input, { target: { value: "air" } });
    await advanceSearchDebounce();

    rerender(<SearchBar basePath="/us/en" autoFocus={false} />);
    act(() => input.blur());
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByText("Digital Air Fryer")).not.toBeInTheDocument();

    rerender(<SearchBar basePath="/us/en" autoFocus={true} />);

    expect(input).toHaveValue("air");
    expect(screen.getByText("Digital Air Fryer")).toBeInTheDocument();
  });

  it("submits the query and resets to the initial state", async () => {
    render(<SearchBar basePath="/us/en" />);
    const input = screen.getByRole("combobox", { name: "search" });

    fireEvent.change(input, { target: { value: "air" } });
    await advanceSearchDebounce();
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockPush).toHaveBeenCalledWith("/us/en/products?q=air");
    expect(input).toHaveValue("");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("uses arrow keys to navigate suggestions and Enter to open one", async () => {
    mockGetProducts.mockResolvedValue(response([airFryer, airPurifier]));
    render(<SearchBar basePath="/us/en" />);
    const input = screen.getByRole("combobox", { name: "search" });

    fireEvent.change(input, { target: { value: "air" } });
    await advanceSearchDebounce();
    fireEvent.keyDown(input, { key: "ArrowDown" });

    expect(input).toHaveAttribute("aria-activedescendant", "search-option-0");
    expect(
      screen.getByRole("listbox", { name: "searchSuggestions" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /Digital Air Fryer/ }),
    ).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-activedescendant", "search-option-1");

    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input).toHaveAttribute("aria-activedescendant", "search-option-0");

    fireEvent.keyDown(input, { key: "Enter" });
    expect(mockPush).toHaveBeenCalledWith("/us/en/products/digital-air-fryer");
  });

  it("keeps results open when Tab moves focus to view all", async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<SearchBar basePath="/us/en" />);
    const input = screen.getByRole("combobox", { name: "search" });

    fireEvent.change(input, { target: { value: "air" } });
    await screen.findByText("Digital Air Fryer");
    await user.click(input);

    await user.tab();
    const viewAll = screen.getByRole("link", {
      name: "viewAllResultsFor:air",
    });
    expect(viewAll).toHaveAttribute("href", "/us/en/products?q=air");
    expect(viewAll).toHaveFocus();

    await act(() => new Promise((resolve) => window.setTimeout(resolve, 250)));
    expect(screen.getByText("Digital Air Fryer")).toBeInTheDocument();
    expect(viewAll).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(input).toHaveValue("");
    expect(viewAll).not.toBeInTheDocument();
  });

  it("closes the suggestion list with Escape", async () => {
    render(<SearchBar basePath="/us/en" />);
    const input = screen.getByRole("combobox", { name: "search" });

    fireEvent.change(input, { target: { value: "air" } });
    await advanceSearchDebounce();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).not.toHaveAttribute("aria-activedescendant");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("discards a stale response when a newer query resolves first", async () => {
    let resolveFirst: (value: never) => void = () => undefined;
    let resolveSecond: (value: never) => void = () => undefined;
    const firstRequest = new Promise<never>((resolve) => {
      resolveFirst = resolve;
    });
    const secondRequest = new Promise<never>((resolve) => {
      resolveSecond = resolve;
    });
    mockGetProducts
      .mockReturnValueOnce(firstRequest)
      .mockReturnValueOnce(secondRequest);

    render(<SearchBar basePath="/us/en" />);
    const input = screen.getByRole("combobox", { name: "search" });

    fireEvent.change(input, { target: { value: "ai" } });
    await advanceSearchDebounce();
    fireEvent.change(input, { target: { value: "air" } });
    await advanceSearchDebounce();

    await act(async () => resolveSecond(response([airPurifier])));
    expect(screen.getByText("Air Purifier")).toBeInTheDocument();

    await act(async () => resolveFirst(response([airFryer])));
    expect(screen.queryByText("Digital Air Fryer")).not.toBeInTheDocument();
    expect(screen.getByText("Air Purifier")).toBeInTheDocument();
  });

  it("clears a pending debounce when unmounted", () => {
    const { unmount } = render(<SearchBar basePath="/us/en" />);
    const input = screen.getByRole("combobox", { name: "search" });

    fireEvent.change(input, { target: { value: "air" } });
    unmount();
    act(() => vi.advanceTimersByTime(300));

    expect(mockGetProducts).not.toHaveBeenCalled();
  });
});
