"use client";

import type { Product } from "@spree/sdk";
import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { ProductImage } from "@/components/ui/product-image";
import { useStore } from "@/contexts/StoreContext";
import { trackQuickSearch, trackSelectItem } from "@/lib/analytics/gtm";
import { getProducts } from "@/lib/data/products";

interface SearchBarProps {
  basePath: string;
  autoFocus?: boolean;
  onNavigate?: () => void;
}

export function SearchBar({ basePath, autoFocus, onNavigate }: SearchBarProps) {
  const router = useRouter();
  const { currency } = useStore();
  const t = useTranslations("products");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  // The search stays mounted so its query and results survive closing.
  // Focus is an external browser interaction, so an effect is appropriate here.
  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Fetch suggestions
  const fetchSuggestions = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.length < 2) {
        setSuggestions([]);
        return;
      }

      const currentRequestId = requestIdRef.current;
      setLoading(true);
      try {
        const response = await getProducts({
          search: searchQuery,
          fields: ["name", "slug", "price", "thumbnail_url"],
          limit: 6,
        });
        // Discard stale responses if a newer query has been issued
        if (requestIdRef.current !== currentRequestId) return;
        setSuggestions(response.data);
        if (response.data.length > 0) {
          trackQuickSearch(response.data, searchQuery, currency);
        }
      } catch (error) {
        if (requestIdRef.current !== currentRequestId) return;
        console.error("Search failed:", error);
        setSuggestions([]);
      } finally {
        if (requestIdRef.current === currentRequestId) {
          setLoading(false);
        }
      }
    },
    [currency],
  );

  // Debounced search — called from onChange handler, no useEffect needed
  const handleQueryChange = (value: string) => {
    setQuery(value);
    setIsOpen(true);
    setSelectedIndex(-1);
    requestIdRef.current += 1;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    if (value.length >= 2) {
      setLoading(true);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        fetchSuggestions(value);
      }, 300);
    } else {
      setSuggestions([]);
      setLoading(false);
    }
  };

  const resetSearch = () => {
    requestIdRef.current += 1;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setQuery("");
    setSuggestions([]);
    setIsOpen(false);
    setLoading(false);
    setSelectedIndex(-1);
  };

  const submitSearch = () => {
    const searchQuery = query.trim();
    if (!searchQuery) return;

    router.push(`${basePath}/products?q=${encodeURIComponent(searchQuery)}`);
    resetSearch();
    inputRef.current?.blur();
    onNavigate?.();
  };

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitSearch();
  };

  // Handle suggestion click
  const handleSuggestionClick = (product: Product, index: number) => {
    trackSelectItem(product, "quick-search", "Quick Search", index, currency);
    router.push(`${basePath}/products/${product.slug}`);
    resetSearch();
    onNavigate?.();
  };

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>): void => {
    if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return;

    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleFocus = (): void => {
    setIsOpen(true);
  };

  const showSuggestions =
    isOpen && (suggestions.length > 0 || loading || query.length >= 2);
  const isListboxOpen = isOpen && !loading && suggestions.length > 0;
  const searchQuery = query.trim();

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && showSuggestions) {
      e.preventDefault();
      e.stopPropagation();
      setIsOpen(false);
      setSelectedIndex(-1);
      return;
    }

    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        if (selectedIndex >= 0) {
          e.preventDefault();
          handleSuggestionClick(suggestions[selectedIndex], selectedIndex);
        } else {
          e.preventDefault();
          submitSearch();
        }
        break;
    }
  };

  return (
    <div className="relative" onBlur={handleBlur}>
      <form onSubmit={handleSubmit}>
        <InputGroup className="h-11 rounded-sm border border-gray-300 bg-white has-[[data-slot=input-group-control]:focus]:border-gray-900 has-[[data-slot=input-group-control]:focus]:[outline:none]">
          <InputGroupInput
            ref={inputRef}
            type="text"
            inputMode="search"
            enterKeyHint="search"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            placeholder={t("search")}
            role="combobox"
            aria-expanded={isListboxOpen}
            aria-controls={isListboxOpen ? "search-suggestions" : undefined}
            aria-activedescendant={
              isListboxOpen && selectedIndex >= 0
                ? `search-option-${selectedIndex}`
                : undefined
            }
            aria-autocomplete="list"
            aria-label={t("search")}
            className="px-0 text-sm placeholder:text-gray-500 placeholder:opacity-100"
          />
          <InputGroupAddon className="pr-3 text-gray-500">
            <Search className="size-[18px] stroke-[1.5]" />
          </InputGroupAddon>
        </InputGroup>
      </form>

      {/* Suggestions dropdown */}
      {showSuggestions && (
        <div className="fixed left-0 right-0 mt-1 bg-white border-b border-gray-200 z-50">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            {loading ? (
              <div
                role="status"
                className="p-4 text-center text-gray-500 text-sm"
              >
                {t("searching")}
              </div>
            ) : suggestions.length > 0 ? (
              <>
                <div
                  id="search-suggestions"
                  role="listbox"
                  aria-label={t("searchSuggestions")}
                >
                  {suggestions.map((product, index) => (
                    <button
                      key={product.id}
                      id={`search-option-${index}`}
                      type="button"
                      role="option"
                      aria-selected={index === selectedIndex}
                      onClick={() => handleSuggestionClick(product, index)}
                      tabIndex={-1}
                      className={`w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors ${
                        index === selectedIndex ? "bg-gray-50" : ""
                      }`}
                    >
                      {/* Thumbnail */}
                      <div className="relative w-10 h-10 bg-gray-100 rounded flex-shrink-0 overflow-hidden">
                        <ProductImage
                          src={product.thumbnail_url}
                          alt={product.name}
                          fill
                          className="object-cover"
                          iconClassName="w-5 h-5"
                        />
                      </div>
                      {/* Name and price */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {product.name}
                        </p>
                        {product.price?.display_amount && (
                          <p className="text-sm text-gray-500">
                            {product.price.display_amount}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
                {searchQuery && (
                  <div className="border-t border-gray-100">
                    <Link
                      href={`${basePath}/products?q=${encodeURIComponent(searchQuery)}`}
                      onClick={() => {
                        resetSearch();
                        onNavigate?.();
                      }}
                      className="block w-full p-3 text-sm text-primary hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary text-center font-medium"
                    >
                      {t("viewAllResultsFor", { query: searchQuery })}
                    </Link>
                  </div>
                )}
              </>
            ) : query.length >= 2 ? (
              <div
                role="status"
                className="p-4 text-center text-gray-500 text-sm"
              >
                {t("noProductsFound")}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
