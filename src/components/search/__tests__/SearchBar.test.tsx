import type { Product } from "@spree/sdk";
import { act, fireEvent, render, screen } from "@testing-library/react";
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
