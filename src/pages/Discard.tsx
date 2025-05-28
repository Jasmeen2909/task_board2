import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import FilterBar from "../components/FilterBar";
import { Task } from "../types/tasks";
import TaskDetailsModal from "../components/TasksDetailsModal";
import LogoutConfirmDialog from "../components/Logout";
import { useLoader } from "../context/LoaderContext";
import { fetchCategoryData } from "../services/taskService";
import { useTasks } from "../hooks/useTasks";

export default function Discard() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [discardedTasks, setDiscardedTasks] = useState<Task[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [subcategoryMap, setSubcategoryMap] = useState<
    Record<string, string[]>
  >({});
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const { setLoading } = useLoader();
  const [sidebarOpen, setSidebarOpen] = useState(
    () => window.innerWidth >= 768
  );

  const [hasMoreDiscard, setHasMoreDiscard] = useState(true);
  const PAGE_SIZE = 10;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [loadingDiscard, setLoadingDiscard] = useState(false);
  const [discardCount, setDiscardCount] = useState(0);
  const discardPageRef = useRef(0);
  const loadingDiscardRef = useRef(false);

  const {
    categoryFilter,
    setCategoryFilter,
    subcategoryFilter,
    setSubcategoryFilter,
    dateRange,
    setDateRange,
    limit,
    setLimit,
    searchQuery,
    setSearchQuery,
    selectedCountries,
    setSelectedCountries,
    hourlyBudgetType,
    setHourlyBudgetType,
    priceRange,
    setPriceRange,
    countryOptions,
    fetchTasksByStatus,
    getTaskCountByStatus,
  } = useTasks();

  useEffect(() => {
    const handleResize = () => {
      setSidebarOpen(window.innerWidth >= 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const scrollEl = scrollRef.current;

    const handleScroll = () => {
      if (
        scrollEl &&
        scrollEl.scrollTop + scrollEl.clientHeight >=
          scrollEl.scrollHeight - 300 &&
        hasMoreDiscard &&
        !loadingDiscard
      ) {
        fetchDiscardedTasks();
      }
    };

    scrollEl?.addEventListener("scroll", handleScroll);
    return () => scrollEl?.removeEventListener("scroll", handleScroll);
  }, [hasMoreDiscard, loadingDiscard]);

  useEffect(() => {
  const runFilterUpdate = async () => {
    setLoading(true);
    discardPageRef.current = 0; 
    setDiscardedTasks([]); 
    setHasMoreDiscard(true);
    await fetchDiscardedTasks(true);
    await fetchDiscardCount();
    setLoading(false);
  };

  runFilterUpdate();
  getUser();
}, [
  categoryFilter,
  subcategoryFilter,
  dateRange,
  limit, 
  searchQuery,
  selectedCountries,
  hourlyBudgetType,
  priceRange,
]);


  useEffect(() => {
    const loadCategoryData = async () => {
      setLoading(true);
      const { categoryOptions, subcategoryMap } = await fetchCategoryData();
      setCategoryOptions(categoryOptions);
      setSubcategoryMap(subcategoryMap);
      setLoading(false);
    };
    loadCategoryData();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("realtime-discarded-projects")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "projects",
          filter: "status=eq.Discarded",
        },
        () => {
          fetchDiscardedTasks();
          fetchDiscardCount();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "projects",
          filter: "status=eq.Discarded",
        },
        () => {
          fetchDiscardedTasks();
          fetchDiscardCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) setUserEmail(user.email ?? "");
  };

  const fetchDiscardedTasks = async (reset = false) => {
    if (loadingDiscardRef.current) return;

    loadingDiscardRef.current = true;
    setLoadingDiscard(true);

    const page = reset ? 0 : discardPageRef.current;
    const effectiveLimit = limit ?? PAGE_SIZE;
    const offset = page * effectiveLimit;

    const data = await fetchTasksByStatus("Discarded", {
      categoryFilter,
      subcategoryFilter,
      dateRange,
      limit: effectiveLimit,
      offset,
      searchQuery,
      selectedCountries,
      hourlyBudgetType,
      priceFrom: priceRange.from,
      priceTo: priceRange.to,
    });

    if (reset) {
      setDiscardedTasks(data);
      discardPageRef.current = 1;
    } else {
      setDiscardedTasks((prev) => {
        const existingIds = new Set(prev.map((t) => t.id));
        const filtered = data.filter((t) => !existingIds.has(t.id));
        return [...prev, ...filtered];
      });

      if (data.length > 0) {
        discardPageRef.current += 1;
      }
    }

    setHasMoreDiscard(data.length === effectiveLimit);
    setLoadingDiscard(false);
    loadingDiscardRef.current = false;
  };

  const fetchDiscardCount = async () => {
    const count = await getTaskCountByStatus(
      "Discarded",
      categoryFilter,
      subcategoryFilter,
      dateRange,
      searchQuery,
      selectedCountries,
      hourlyBudgetType,
      priceRange
    );
    setDiscardCount(count);
  };

  const handleLogout = () => setShowLogoutConfirm(true);
  const confirmLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <div
      className={`flex min-h-screen ${
        sidebarOpen ? "overflow-hidden" : "overflow-x-auto"
      }`}
    >
      <Sidebar
        sidebarOpen={sidebarOpen}
        userEmail={userEmail}
        setSidebarOpen={setSidebarOpen}
        handleLogout={handleLogout}
      />
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${
          sidebarOpen && window.innerWidth >= 768
            ? "ml-64"
            : window.innerWidth >= 768
            ? "ml-16"
            : ""
        }`}
      >
        <Header
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          userEmail={userEmail}
          dropdownOpen={dropdownOpen}
          setDropdownOpen={setDropdownOpen}
          handleLogout={handleLogout}
        />

        <div className="flex-1 flex flex-col p-6 bg-gray-100 mt-10 min-h-0 w-full">
          <h1 className="font-bold text-2xl mb-2">Discard</h1>

          <div className="bg-gray-100 sticky top-20 z-10">
            <FilterBar
              categoryFilter={categoryFilter}
              setCategoryFilter={setCategoryFilter}
              subcategoryFilter={subcategoryFilter}
              setSubcategoryFilter={setSubcategoryFilter}
              limit={limit}
              setLimit={setLimit}
              dateRange={dateRange}
              setDateRange={setDateRange}
              categoryOptions={categoryOptions}
              subcategoryMap={subcategoryMap}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              countryOptions={countryOptions}
              selectedCountries={selectedCountries}
              setSelectedCountries={setSelectedCountries}
              hourlyBudgetType={hourlyBudgetType}
              setHourlyBudgetType={setHourlyBudgetType}
              priceRange={priceRange}
              setPriceRange={setPriceRange}
            />
          </div>

          <div className="bg-white rounded-lg shadow p-4 flex flex-col">
            <div className="font-semibold mb-4 flex items-center text-red-500">
              <span className="w-3 h-3 bg-red-500 rounded-full mr-2" />
              <span className="text-black">
                Discard ({discardedTasks.length} of {discardCount})
              </span>
            </div>

            <div
              ref={scrollRef}
              className="space-y-3 overflow-y-auto pr-2"
              style={{
                maxHeight:
                  window.innerWidth < 768
                    ? "calc(100vh - 260px)"
                    : "calc(100vh - 260px)",
                overflowY: "scroll",
              }}
            >
              {discardedTasks.map((task, index) => (
                <div
                  key={`${task.id}-${index}`}
                  className="border border-gray-300 p-4 rounded bg-white shadow-sm cursor-pointer hover:shadow"
                  onClick={() => {
                    setSelectedTaskId(task.id.toString());
                    setModalOpen(true);
                  }}
                >
                  <h2 className="font-semibold">{task.title}</h2>
                  <p className="text-sm text-gray-600 line-clamp-1">
                    {task.description}
                  </p>
                </div>
              ))}

              {loadingDiscard && (
                <p className="text-center py-2 text-gray-500">
                  Loading more tasks...
                </p>
              )}

              {selectedTaskId && (
                <TaskDetailsModal
                  taskId={selectedTaskId}
                  isOpen={modalOpen}
                  onClose={() => setModalOpen(false)}
                  onStatusChange={(updatedTask) => {
                    if (updatedTask.status !== "Discarded") {
                      setModalOpen(false);
                      setDiscardedTasks([]);
                      fetchDiscardedTasks(true);
                      fetchDiscardCount();
                    }
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 backdrop-blur-sm z-30 sm:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <LogoutConfirmDialog
        isOpen={showLogoutConfirm}
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={confirmLogout}
      />
    </div>
  );
}
