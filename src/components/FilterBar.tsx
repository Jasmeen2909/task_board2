import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch } from "@fortawesome/free-solid-svg-icons";
import { DateRange } from "react-date-range";
import { useState, useEffect } from "react";
import { useRef } from "react";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";

type Setter<T> = (val: T) => void;

interface FilterBarProps {
  statusFilter?: string | null;
  setStatusFilter?: Setter<string | null>;
  categoryFilter: string | null;
  setCategoryFilter: Setter<string | null>;
  subcategoryFilter: string | null;
  setSubcategoryFilter: Setter<string | null>;
  limit: number | null;
  setLimit: Setter<number | null>;
  dateRange: { from: string | null; to: string | null };
  setDateRange: Setter<{ from: string | null; to: string | null }>;
  categoryOptions: string[];
  subcategoryMap: Record<string, string[]>;
  searchQuery: string | null;
  setSearchQuery: Setter<string | null>;
  countryOptions: string[];
  selectedCountries: string[];
  setSelectedCountries: (countries: string[]) => void;
  hourlyBudgetType: string | null;
  setHourlyBudgetType: Setter<string | null>;
  priceRange: { from: number | null; to: number | null };
  setPriceRange: Setter<{ from: number | null; to: number | null }>;
}

export default function FilterBar({
  statusFilter,
  setStatusFilter,
  categoryFilter,
  setCategoryFilter,
  subcategoryFilter,
  setSubcategoryFilter,
  limit,
  setLimit,
  dateRange,
  setDateRange,
  categoryOptions,
  subcategoryMap,
  searchQuery,
  setSearchQuery,
  countryOptions,
  selectedCountries,
  setSelectedCountries,
  hourlyBudgetType,
  setHourlyBudgetType,
  priceRange,
  setPriceRange,
}: FilterBarProps) {
  const calendarRef = useRef<HTMLDivElement>(null);
  const countryRef = useRef<HTMLDivElement>(null);
  const [searchInput, setSearchInput] = useState(searchQuery ?? "");
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [lastClickedDate, setLastClickedDate] = useState<Date | null>(null);
  const [range, setRange] = useState<any[]>([
    {
      startDate: dateRange.from ? new Date(dateRange.from) : new Date(),
      endDate: dateRange.to ? new Date(dateRange.to) : new Date(),
      key: "selection",
    },
  ]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;

      if (calendarRef.current && !calendarRef.current.contains(target)) {
        setCalendarOpen(false);
        setLastClickedDate(null);
      }

      if (countryRef.current && !countryRef.current.contains(target)) {
        setCountryDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (dateRange.from && dateRange.to) {
      const localStart = new Date(dateRange.from);
      const localEnd = new Date(dateRange.to);

      setRange([
        {
          startDate: new Date(
            localStart.getUTCFullYear(),
            localStart.getUTCMonth(),
            localStart.getUTCDate()
          ),
          endDate: new Date(
            localEnd.getUTCFullYear(),
            localEnd.getUTCMonth(),
            localEnd.getUTCDate()
          ),
          key: "selection",
        },
      ]);
    }
  }, [dateRange]);

  useEffect(() => {
    if (!categoryFilter) {
      setSubcategoryFilter(null);
    } else if (
      !subcategoryMap[categoryFilter]?.includes(subcategoryFilter || "")
    ) {
      setSubcategoryFilter(null);
    }
  }, [categoryFilter, subcategoryMap, subcategoryFilter, setSubcategoryFilter]);

  useEffect(() => {
    const delay = setTimeout(() => {
      setSearchQuery(searchInput.trim() || null);
    }, 500);

    return () => clearTimeout(delay);
  }, [searchInput, setSearchQuery]);

  useEffect(() => {
    if (!hourlyBudgetType || hourlyBudgetType === "") {
      setPriceRange({ from: null, to: null });
      setHourlyBudgetType(null);
    }
  }, [hourlyBudgetType, setHourlyBudgetType]);

  const formatDateDisplay = (date: Date | null) => {
    if (!date) return "";
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(date);
  };

  const filteredCountries = countryOptions.filter((country) =>
    country.toLowerCase().includes(searchText.toLowerCase())
  );

  const toggleCountry = (country: string) => {
    if (selectedCountries.includes(country)) {
      setSelectedCountries(selectedCountries.filter((c) => c !== country));
    } else {
      setSelectedCountries([...selectedCountries, country]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedCountries.length === countryOptions.length) {
      setSelectedCountries([]);
    } else {
      setSelectedCountries([...countryOptions]);
    }
  };

  return (
    <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-2 md:gap-4 mb-6">
      <div className="relative w-full md:w-auto">
        <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
          <FontAwesomeIcon icon={faSearch} />
        </span>
        <input
          type="text"
          placeholder="Search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-full md:w-40 border border-gray-300 pl-10 pr-4 py-2 rounded text-sm bg-white"
        />
      </div>

      {typeof statusFilter !== "undefined" &&
        typeof setStatusFilter !== "undefined" && (
          <select
            onChange={(e) => setStatusFilter(e.target.value || null)}
            className="w-full md:w-40 border border-gray-300 px-3 py-2 rounded text-sm bg-white"
            value={statusFilter ?? ""}
          >
            <option value="">Status</option>
            <option value="To Do">To Do</option>
            <option value="In Progress">In Progress</option>
            <option value="Done">Done</option>
          </select>
        )}

      <select
        onChange={(e) => setCategoryFilter(e.target.value || null)}
        className="w-full md:w-40 border border-gray-300 px-3 py-2 rounded text-sm bg-white"
        value={categoryFilter ?? ""}
      >
        <option value="">Category</option>
        {categoryOptions.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </select>

      {categoryFilter && (
        <select
          onChange={(e) => setSubcategoryFilter(e.target.value || null)}
          className="w-full md:w-40 border border-gray-300 px-3 py-2 rounded text-sm bg-white"
          value={subcategoryFilter ?? ""}
        >
          <option value="">Subcategory</option>
          {(subcategoryMap[categoryFilter] || []).map((sub) => (
            <option key={sub} value={sub}>
              {sub}
            </option>
          ))}
        </select>
      )}

      <div ref={countryRef} className="relative w-full md:w-40">
        <button
          onClick={() => setCountryDropdownOpen((prev) => !prev)}
          className="w-full border border-gray-300 px-3 py-2 rounded text-sm bg-white text-left"
        >
          {selectedCountries.length > 0
            ? `${selectedCountries.length} selected`
            : "Select countries"}
        </button>

        {countryDropdownOpen && (
          <div className="absolute z-50 mt-2 w-full max-h-64 overflow-y-auto bg-white border border-gray-300 rounded shadow-md p-3 space-y-2">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={selectedCountries.length === countryOptions.length}
                onChange={toggleSelectAll}
                className="mr-2"
              />
              <span className="text-sm font-medium">
                {selectedCountries.length === countryOptions.length
                  ? "Unselect All"
                  : "Select All"}
              </span>
            </div>

            <input
              type="text"
              placeholder="Search country..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full border border-gray-300 px-2 py-1 rounded text-sm"
            />

            {filteredCountries.length === 0 ? (
              <p className="text-sm text-gray-500">No countries found</p>
            ) : (
              filteredCountries.map((country) => (
                <label
                  key={country}
                  className="flex items-center cursor-pointer text-sm space-x-2"
                >
                  <input
                    type="checkbox"
                    checked={selectedCountries.includes(country)}
                    onChange={() => toggleCountry(country)}
                    className="mr-2"
                  />
                  <span>{country}</span>
                </label>
              ))
            )}
          </div>
        )}
      </div>

      <select
        value={hourlyBudgetType ?? ""}
        onChange={(e) => setHourlyBudgetType(e.target.value || null)}
        className="w-full md:w-40 border border-gray-300 px-3 py-2 rounded text-sm bg-white"
      >
        <option value="">Price Type</option>
        <option value="DEFAULT">Default</option>
        <option value="MANUAL">Manual</option>
        <option value="NOT_PROVIDED">Not Provided</option>
        <option value="null">Fixed</option>
      </select>

      {["DEFAULT", "MANUAL"].includes(hourlyBudgetType ?? "") && (
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="From"
            className="w-full md:w-32 border border-gray-300 px-3 py-2 rounded text-sm"
            value={priceRange.from ?? ""}
            onChange={(e) =>
              setPriceRange({
                ...priceRange,
                from: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
          <input
            type="number"
            placeholder="To"
            className="w-full md:w-32 border border-gray-300 px-3 py-2 rounded text-sm"
            value={priceRange.to ?? ""}
            onChange={(e) =>
              setPriceRange({
                ...priceRange,
                to: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
        </div>
      )}

      {hourlyBudgetType === "null" && (
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="From"
            className="w-full md:w-32 border border-gray-300 px-3 py-2 rounded text-sm"
            value={priceRange.from ?? ""}
            onChange={(e) =>
              setPriceRange({
                ...priceRange,
                from: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
          <input
            type="number"
            placeholder="To"
            className="w-full md:w-32 border border-gray-300 px-3 py-2 rounded text-sm"
            value={priceRange.to ?? ""}
            onChange={(e) =>
              setPriceRange({
                ...priceRange,
                to: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
        </div>
      )}

      <div className="relative w-full md:w-auto flex items-center">
        <button
          type="button"
          onClick={() => setCalendarOpen((open) => !open)}
          className="w-full md:w-40 border border-gray-300 px-3 py-2 rounded text-sm text-left bg-white truncate"
          style={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {dateRange.from && dateRange.to
            ? `${formatDateDisplay(
                new Date(dateRange.from)
              )} - ${formatDateDisplay(new Date(dateRange.to))}`
            : "Date Range"}
        </button>
        {dateRange.from && dateRange.to && (
          <button
            className="text-gray-400 hover:text-red-500 text-lg px-1 focus:outline-none"
            title="Clear date filter"
            type="button"
            onClick={() => {
              setDateRange({ from: null, to: null });
              setRange([
                {
                  startDate: new Date(),
                  endDate: new Date(),
                  key: "selection",
                },
              ]);
              setLastClickedDate(null);
            }}
          >
            &times;
          </button>
        )}
        {calendarOpen && (
          <div
            ref={calendarRef}
            className="absolute left-0 top-full mt-2 bg-white rounded-md shadow-lg border border-gray-200 z-50"
          >
            <DateRange
              ranges={range}
              onChange={({ selection }) => {
                const start = selection.startDate;
                const end = selection.endDate;
                if (!start || !end) return;

                const isSameDay = start.getTime() === end.getTime();
                const isRepeatClick =
                  lastClickedDate?.getTime() === start.getTime();

                const startUTC = new Date(
                  Date.UTC(
                    start.getFullYear(),
                    start.getMonth(),
                    start.getDate()
                  )
                );
                const endUTC = new Date(
                  Date.UTC(
                    end.getFullYear(),
                    end.getMonth(),
                    end.getDate(),
                    23,
                    59,
                    59
                  )
                );

                if (isSameDay && isRepeatClick) {
                  setDateRange({
                    from: startUTC.toISOString(),
                    to: endUTC.toISOString(),
                  });
                  setCalendarOpen(false);
                  setLastClickedDate(null);
                } else if (!isSameDay) {
                  setDateRange({
                    from: startUTC.toISOString(),
                    to: endUTC.toISOString(),
                  });
                  setCalendarOpen(false);
                  setLastClickedDate(null);
                } else {
                  setLastClickedDate(start);
                  setRange([{ ...selection }]);
                }
              }}
              moveRangeOnFirstSelection={false}
              editableDateInputs={true}
              showDateDisplay={false}
              rangeColors={["#f97316"]}
              direction="horizontal"
            />
          </div>
        )}
      </div>
      <select
        onChange={(e) => setLimit(Number(e.target.value) || null)}
        className="w-full md:w-40 border border-gray-300 px-3 py-2 rounded text-sm bg-white"
        value={limit ?? ""}
      >
        <option value="">Limit</option>
        <option value="20">20</option>
        <option value="30">30</option>
        <option value="50">50</option>
        <option value="70">70</option>
        <option value="100">100</option>
      </select>
    </div>
  );
}
