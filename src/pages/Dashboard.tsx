import { useEffect, useState, useRef } from "react";
import { supabase } from "../supabaseClient";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import FilterBar from "../components/FilterBar";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragEndEvent,
} from "@dnd-kit/core";
import { DroppableColumn } from "../components/DroppableColumn";
import { DraggableCard } from "../components/DraggableCard";
import { useTasks } from "../hooks/useTasks";
import { Task } from "../types/tasks";
import TaskDetailsModal from "../components/TasksDetailsModal";
import LogoutConfirmDialog from "../components/Logout";
import { useLoader } from "../context/LoaderContext";

export default function Dashboard() {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [subcategoryMap, setSubcategoryMap] = useState<
    Record<string, string[]>
  >({});
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState<StatusKey>("to-do");
  const [countryOptions, setCountryOptions] = useState<string[]>([]);

  const {
    tasksByStatus,
    setTasksByStatus,
    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    subcategoryFilter,
    setSubcategoryFilter,
    dateRange,
    setDateRange,
    limit,
    setLimit,
    loadMoreTasks,
    loading,
    hasMoreByStatus,
    resetPagination,
    moveTask,
    findColumnOfTask,
    searchQuery,
    setSearchQuery,
    fetchStatusWiseCounts,
    totalCountByStatus,
    statusKeyArray,
    selectedCountries,
    setSelectedCountries,
    hourlyBudgetType,
    setHourlyBudgetType,
    priceRange,
    setPriceRange,
  } = useTasks();

  const { setLoading } = useLoader();
  const [sidebarOpen, setSidebarOpen] = useState(
    () => window.innerWidth >= 768
  );

  type StatusKey = (typeof statusKeyArray)[number];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const columnMap: Record<StatusKey, string> = {
    "to-do": "To Do",
    "in-progress": "In Progress",
    done: "Done",
  };

  useEffect(() => {
    const handleResize = () => {
      setSidebarOpen(window.innerWidth >= 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      resetPagination();
      await loadMoreTasks(true);
      await fetchStatusWiseCounts();
      await getUser();
      setLoading(false);
    };

    init();
  }, [
    statusFilter,
    categoryFilter,
    subcategoryFilter,
    dateRange,
    searchQuery,
    limit,
    selectedCountries,
  ]);

  useEffect(() => {
    if (window.innerWidth < 768) return;
    const scrollEl = scrollRef.current;
    const handleScroll = () => {
      if (
        scrollEl &&
        scrollEl.scrollTop + scrollEl.clientHeight >=
          scrollEl.scrollHeight - 300 &&
        !loading
      ) {
        loadMoreTasks();
      }
    };
    scrollEl?.addEventListener("scroll", handleScroll);
    return () => scrollEl?.removeEventListener("scroll", handleScroll);
  }, [loading, loadMoreTasks]);

  useEffect(() => {
    if (window.innerWidth >= 768) return;
    const scrollEl = scrollRef.current;
    const handleScroll = () => {
      if (
        scrollEl &&
        scrollEl.scrollTop + scrollEl.clientHeight >=
          scrollEl.scrollHeight - 300 &&
        !loading &&
        hasMoreByStatus[activeMobileTab] &&
        tasksByStatus[activeMobileTab].length <
          totalCountByStatus[activeMobileTab]
      ) {
        loadMoreTasks(false, activeMobileTab);
      }
    };
    scrollEl?.addEventListener("scroll", handleScroll);
    return () => scrollEl?.removeEventListener("scroll", handleScroll);
  }, [
    activeMobileTab,
    loading,
    hasMoreByStatus,
    tasksByStatus,
    totalCountByStatus,
    loadMoreTasks,
  ]);

  useEffect(() => {
    if (window.innerWidth < 768 && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [activeMobileTab]);

  useEffect(() => {
    const fetchCategoryData = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("projects")
        .select("category, subcategory");

      if (!error && data) {
        const map: Record<string, string[]> = {};
        const categories = new Set<string>();

        data.forEach((row) => {
          if (!row.category) return;
          categories.add(row.category);
          if (!map[row.category]) map[row.category] = [];
          if (row.subcategory && !map[row.category].includes(row.subcategory)) {
            map[row.category].push(row.subcategory);
          }
        });

        setCategoryOptions(Array.from(categories));
        setSubcategoryMap(map);
      }
      setLoading(false);
    };

    fetchCategoryData();
  }, []);

  useEffect(() => {
    const fetchCountryData = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("projects")
        .select("prospect_location_country");
      if (!error && data) {
        const uniqueCountries = Array.from(
          new Set(
            data
              .map((row) => row.prospect_location_country)
              .filter((c): c is string => typeof c === "string")
          )
        ).sort();
        setCountryOptions(uniqueCountries);
      }
      setLoading(false);
    };

    fetchCountryData();
  }, []);

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setIsDragging(false);

    if (!over || active.id === over.id) return;

    const activeId = active.id.toString();
    const overId = over.id.toString();

    const sourceCol = findColumnOfTask(activeId) as StatusKey | null;
    const destCol =
      (findColumnOfTask(overId) as StatusKey | null) || (over.id as StatusKey);

    if (!sourceCol || !destCol) return;

    const destinationTasks = tasksByStatus[destCol];
    let destIndex = destinationTasks.findIndex(
      (t) => t.id.toString() === overId
    );

    if (destIndex === -1) {
      destIndex = destinationTasks.length;
    }

    if (sourceCol === destCol) {
      const sourceIndex = tasksByStatus[sourceCol].findIndex(
        (t) => t.id.toString() === activeId
      );
      if (sourceIndex < destIndex) destIndex--;
    }

    setLoading(true);
    await moveTask(activeId, sourceCol, destCol, destIndex);
    await fetchStatusWiseCounts();
    setLoading(false);
    setActiveTask(null);
  };

  const getUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) setUserEmail(user?.email ?? "");
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

        <div className="flex-1 flex flex-col p-6 bg-gray-100 mt-10 min-h-0">
          <h1 className="font-bold text-2xl mb-2">Dashboard</h1>

          <div className="bg-gray-100 sticky top-20 z-10">
            <FilterBar
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
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

          <div className="md:hidden bg-gray-200 rounded-xl p-1 flex justify-between items-center mb-4">
            {statusKeyArray.map((col) => (
              <button
                key={col}
                onClick={() => setActiveMobileTab(col)}
                className={`flex-1 py-2 rounded-lg font-semibold text-sm transition-colors duration-200 ${
                  activeMobileTab === col
                    ? "bg-white shadow text-black"
                    : "bg-transparent text-gray-600"
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  {col === "to-do" && (
                    <span className="text-yellow-500">●</span>
                  )}
                  {col === "in-progress" && (
                    <span className="text-blue-500">●</span>
                  )}
                  {col === "done" && <span className="text-green-500">●</span>}
                  {columnMap[col]}
                </span>
              </button>
            ))}
          </div>

          <div
            ref={scrollRef}
            className="overflow-y-auto"
            style={{
              maxHeight:
                window.innerWidth < 768 ? "calc(100vh - 150px)" : "unset",
            }}
          >
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={(event) => {
                setIsDragging(true);
                const activeId = event.active.id.toString();
                const col = findColumnOfTask(activeId);
                if (col) {
                  const task = tasksByStatus[col].find(
                    (t) => t.id.toString() === activeId
                  );
                  setActiveTask(task || null);
                }
              }}
              onDragEnd={onDragEnd}
              onDragCancel={() => {
                setIsDragging(false);
                setActiveTask(null);
              }}
            >
              <div className="md:hidden">
                <DroppableColumn
                  key={activeMobileTab}
                  columnId={activeMobileTab}
                  title={columnMap[activeMobileTab]}
                  tasks={tasksByStatus[activeMobileTab]}
                  totalCount={totalCountByStatus[activeMobileTab]}
                  setActiveTask={setActiveTask}
                  isDragging={isDragging}
                  onCardClick={(id) => {
                    setSelectedTaskId(id);
                    setModalOpen(true);
                  }}
                />
              </div>
              <div className="hidden md:grid grid-cols-3 gap-4 h-[calc(100vh-200px)]">
                {statusKeyArray.map((col: StatusKey) => (
                  <DroppableColumn
                    key={col}
                    columnId={col}
                    title={columnMap[col]}
                    tasks={tasksByStatus[col]}
                    totalCount={totalCountByStatus[col]}
                    setActiveTask={setActiveTask}
                    isDragging={isDragging}
                    onCardClick={(id) => {
                      setSelectedTaskId(id);
                      setModalOpen(true);
                    }}
                  />
                ))}
              </div>
              <DragOverlay>
                {activeTask && (
                  <DraggableCard
                    task={activeTask}
                    setActiveTask={setActiveTask}
                  />
                )}
              </DragOverlay>
            </DndContext>

            {loading &&
              tasksByStatus[activeMobileTab]?.length <
                totalCountByStatus[activeMobileTab] && (
                <p className="text-center mt-4 text-gray-500">
                  Loading more tasks...
                </p>
              )}

            {selectedTaskId && (
              <TaskDetailsModal
                taskId={selectedTaskId}
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onStatusChange={async (updatedTask) => {
                  if (!updatedTask) return;
                  const updated = { ...tasksByStatus };
                  for (const key of statusKeyArray) {
                    updated[key] = updated[key].filter(
                      (t) => t.id !== updatedTask.id
                    );
                  }
                  const newStatus = updatedTask.status
                    .toLowerCase()
                    .replace(" ", "-");
                  if (statusKeyArray.includes(newStatus as any)) {
                    updated[newStatus as StatusKey].unshift(updatedTask);
                  }
                  setTasksByStatus(updated);
                  await fetchStatusWiseCounts();
                }}
              />
            )}
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