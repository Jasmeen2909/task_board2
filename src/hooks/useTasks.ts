import { useReducer, useCallback, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import { Task } from "../types/tasks";
import debounce from "lodash.debounce";

export const statusKeyArray = ["to-do", "in-progress", "done"] as const;
export type StatusKey = (typeof statusKeyArray)[number];

type State = {
  tasksByStatus: Record<StatusKey, Task[]>;
  statusFilter: string | null;
  categoryFilter: string | null;
  subcategoryFilter: string | null;
  dateRange: { from: string | null; to: string | null };
  limit: number | null;
  pageByStatus: Record<StatusKey, number>;
  hasMoreByStatus: Record<StatusKey, boolean>;
  loading: boolean;
  searchQuery: string | null;
  totalCountByStatus: Record<StatusKey, number>;
  filtersChanged: boolean;
  selectedCountries: string[];
  countryOptions: string[];
  hourlyBudgetType: string | null;
  priceRange: { from: number | null; to: number | null };
};

type Action =
  | { type: "SET_TASKS_BY_STATUS"; payload: Record<StatusKey, Task[]> }
  | { type: "SET_STATUS_FILTER"; payload: string | null }
  | { type: "SET_CATEGORY_FILTER"; payload: string | null }
  | { type: "SET_SUBCATEGORY_FILTER"; payload: string | null }
  | {
      type: "SET_DATE_RANGE";
      payload: { from: string | null; to: string | null };
    }
  | { type: "SET_LIMIT"; payload: number | null }
  | { type: "SET_PAGE_BY_STATUS"; payload: { status: StatusKey; page: number } }
  | {
      type: "SET_HAS_MORE_BY_STATUS";
      payload: { status: StatusKey; hasMore: boolean };
    }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_SEARCH_QUERY"; payload: string | null }
  | { type: "SET_TOTAL_COUNT_BY_STATUS"; payload: Record<StatusKey, number> }
  | { type: "RESET_PAGINATION" }
  | { type: "SET_FILTERS_CHANGED"; payload: boolean }
  | {
      type: "UPDATE_TASKS_FOR_STATUS";
      payload: { status: StatusKey; tasks: Task[] };
    }
  | { type: "SET_SELECTED_COUNTRIES"; payload: string[] }
  | { type: "SET_COUNTRY_OPTIONS"; payload: string[] }
  | { type: "SET_HOURLY_BUDGET_TYPE"; payload: string | null }
  | {
      type: "SET_PRICE_RANGE";
      payload: { from: number | null; to: number | null };
    };

const initialState: State = {
  tasksByStatus: {
    "to-do": [],
    "in-progress": [],
    done: [],
  },
  statusFilter: null,
  categoryFilter: null,
  subcategoryFilter: null,
  dateRange: { from: null, to: null },
  limit: null,
  loading: false,
  searchQuery: null,
  pageByStatus: {
    "to-do": 0,
    "in-progress": 0,
    done: 0,
  },
  hasMoreByStatus: {
    "to-do": true,
    "in-progress": true,
    done: true,
  },
  totalCountByStatus: {
    "to-do": 0,
    "in-progress": 0,
    done: 0,
  },
  filtersChanged: false,
  selectedCountries: [],
  countryOptions: [],
  hourlyBudgetType: null,
  priceRange: { from: null, to: null },
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_TASKS_BY_STATUS":
      return { ...state, tasksByStatus: action.payload };
    case "UPDATE_TASKS_FOR_STATUS":
      return {
        ...state,
        tasksByStatus: {
          ...state.tasksByStatus,
          [action.payload.status]: action.payload.tasks,
        },
      };
    case "SET_STATUS_FILTER":
      return { ...state, statusFilter: action.payload, filtersChanged: true };
    case "SET_CATEGORY_FILTER":
      return { ...state, categoryFilter: action.payload, filtersChanged: true };
    case "SET_SUBCATEGORY_FILTER":
      return {
        ...state,
        subcategoryFilter: action.payload,
        filtersChanged: true,
      };
    case "SET_DATE_RANGE":
      return { ...state, dateRange: action.payload, filtersChanged: true };
    case "SET_LIMIT":
      return { ...state, limit: action.payload, filtersChanged: true };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_SEARCH_QUERY":
      return { ...state, searchQuery: action.payload, filtersChanged: true };
    case "SET_PAGE_BY_STATUS":
      return {
        ...state,
        pageByStatus: {
          ...state.pageByStatus,
          [action.payload.status]: action.payload.page,
        },
      };
    case "SET_HAS_MORE_BY_STATUS":
      return {
        ...state,
        hasMoreByStatus: {
          ...state.hasMoreByStatus,
          [action.payload.status]: action.payload.hasMore,
        },
      };
    case "SET_TOTAL_COUNT_BY_STATUS":
      return { ...state, totalCountByStatus: action.payload };
    case "RESET_PAGINATION":
      return {
        ...state,
        pageByStatus: { "to-do": 0, "in-progress": 0, done: 0 },
        hasMoreByStatus: { "to-do": true, "in-progress": true, done: true },
        tasksByStatus: { "to-do": [], "in-progress": [], done: [] },
      };
    case "SET_FILTERS_CHANGED":
      return { ...state, filtersChanged: action.payload };
    case "SET_SELECTED_COUNTRIES":
      return {
        ...state,
        selectedCountries: action.payload,
        filtersChanged: true,
      };
    case "SET_COUNTRY_OPTIONS":
      return { ...state, countryOptions: action.payload };
    case "SET_HOURLY_BUDGET_TYPE":
      return {
        ...state,
        hourlyBudgetType: action.payload,
        filtersChanged: true,
      };
    case "SET_PRICE_RANGE":
      return { ...state, priceRange: action.payload, filtersChanged: true };
    default:
      return state;
  }
}

const statusKeyToStatusLabel = (key: StatusKey) =>
  key === "to-do" ? "To Do" : key === "in-progress" ? "In Progress" : "Done";

const PAGE_SIZE = 10;

export function useTasks() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const setTasksByStatus = useCallback((val: Record<StatusKey, Task[]>) => {
    dispatch({ type: "SET_TASKS_BY_STATUS", payload: val });
  }, []);

  const setStatusFilter = useCallback((val: string | null) => {
    dispatch({ type: "SET_STATUS_FILTER", payload: val });
  }, []);

  const setCategoryFilter = useCallback((val: string | null) => {
    dispatch({ type: "SET_CATEGORY_FILTER", payload: val });
  }, []);

  const setSubcategoryFilter = useCallback((val: string | null) => {
    dispatch({ type: "SET_SUBCATEGORY_FILTER", payload: val });
  }, []);

  const setDateRange = useCallback(
    (val: { from: string | null; to: string | null }) => {
      dispatch({ type: "SET_DATE_RANGE", payload: val });
    },
    []
  );

  const setLimit = useCallback((val: number | null) => {
    dispatch({ type: "SET_LIMIT", payload: val });
  }, []);

  const setLoading = useCallback((val: boolean) => {
    dispatch({ type: "SET_LOADING", payload: val });
  }, []);

  const setSearchQuery = useCallback((val: string | null) => {
    dispatch({ type: "SET_SEARCH_QUERY", payload: val });
  }, []);

  const resetPagination = useCallback(() => {
    dispatch({ type: "RESET_PAGINATION" });
  }, []);

  const setTotalCountByStatus = useCallback(
    (val: Record<StatusKey, number>) => {
      dispatch({ type: "SET_TOTAL_COUNT_BY_STATUS", payload: val });
    },
    []
  );

  const setFiltersChanged = useCallback((val: boolean) => {
    dispatch({ type: "SET_FILTERS_CHANGED", payload: val });
  }, []);

  const setSelectedCountries = useCallback((countries: string[]) => {
    dispatch({ type: "SET_SELECTED_COUNTRIES", payload: countries });
  }, []);

  const setCountryOptions = useCallback((countries: string[]) => {
    dispatch({ type: "SET_COUNTRY_OPTIONS", payload: countries });
  }, []);

  const setHourlyBudgetType = useCallback((val: string | null) => {
    dispatch({ type: "SET_HOURLY_BUDGET_TYPE", payload: val });
  }, []);

  const setPriceRange = useCallback(
    (val: { from: number | null; to: number | null }) => {
      dispatch({ type: "SET_PRICE_RANGE", payload: val });
    },
    []
  );

  useEffect(() => {
    const fetchCountryOptions = async () => {
      const { data, error } = await supabase.rpc("get_distinct_countries");

      if (!error && data) {
        const countries = data as string[];

        const uniqueCountries = countries
          .filter((c): c is string => typeof c === "string")
          .sort((a, b) => a.localeCompare(b));

        setCountryOptions(uniqueCountries);
      } else {
        console.error("Error fetching countries:", error);
      }
    };

    fetchCountryOptions();
  }, []);

  const getTaskCountByStatus = async (
    status: string,
    category: string | null,
    subcategory: string | null,
    dateRange: { from: string | null; to: string | null },
    searchQuery: string | null,
    selectedCountries: string[],
    hourlyBudgetType: string | null,
    priceRange: { from: number | null; to: number | null }
  ): Promise<number> => {
    const { data, error } = await supabase.rpc("get_task_count_by_status", {
      task_status: status,
      category_filter: category,
      subcategory_filter: subcategory,
      date_from: dateRange.from,
      date_to: dateRange.to,
      search_query: searchQuery,
      country_filter: selectedCountries.length > 0 ? selectedCountries : null,
      hourly_budget_type:
        hourlyBudgetType === "null"
          ? "null"
          : hourlyBudgetType?.toUpperCase() ?? null,
      price_from: priceRange.from,
      price_to: priceRange.to,
    });

    if (error) {
      console.error(`Count error for status ${status}:`, error);
      return 0;
    }

    return data ?? 0;
  };

  const fetchTasksByStatus = useCallback(
    async (
      status: string,
      filters: {
        categoryFilter?: string | null;
        subcategoryFilter?: string | null;
        dateRange?: { from: string | null; to: string | null };
        searchQuery?: string | null;
        limit?: number | null;
        offset?: number;
        selectedCountries?: string[];
        hourlyBudgetType?: string | null;
        priceFrom?: number | null;
        priceTo?: number | null;
      }
    ): Promise<Task[]> => {
      try {
        const offset = filters.offset ?? 0;
        const effectiveLimit = filters.limit ?? PAGE_SIZE;

        let hourlyBudgetTypeParam: string | null = null;

        if (filters.hourlyBudgetType) {
          if (filters.hourlyBudgetType === "null") {
            hourlyBudgetTypeParam = "null";
          } else {
            hourlyBudgetTypeParam = filters.hourlyBudgetType.toUpperCase();
          }
        }

        const { data, error } = await supabase.rpc("get_task_by_status", {
          task_status: status,
          category_filter: filters.categoryFilter,
          subcategory_filter: filters.subcategoryFilter,
          date_from: filters.dateRange?.from,
          date_to: filters.dateRange?.to,
          limit_count: effectiveLimit,
          offset_count: offset,
          search_query: filters.searchQuery,
          country_filter: filters.selectedCountries?.length
            ? filters.selectedCountries
            : null,
          hourly_budget_type: hourlyBudgetTypeParam,
          price_from: filters.priceFrom,
          price_to: filters.priceTo,
        });

        if (error) {
          console.error("Error fetching tasks:", error);
          return [];
        }

        return data as Task[];
      } catch (error) {
        console.error("Error in fetchTasksByStatus:", error);
        return [];
      }
    },
    []
  );

  const fetchStatusWiseCounts = useCallback(async () => {
    const statusLabels: Record<StatusKey, string> = {
      "to-do": "To Do",
      "in-progress": "In Progress",
      done: "Done",
    };

    const currentState = stateRef.current;
    const existingCounts = { ...currentState.totalCountByStatus };
    const updatedCounts: Record<StatusKey, number> = { ...existingCounts };

    const countPromises = statusKeyArray.map(async (key) => {
      const label = statusLabels[key];
      const isFilteredStatus =
        !currentState.statusFilter || currentState.statusFilter === label;

      const count = await getTaskCountByStatus(
        label,
        isFilteredStatus ? currentState.categoryFilter : null,
        isFilteredStatus ? currentState.subcategoryFilter : null,
        isFilteredStatus ? currentState.dateRange : { from: null, to: null },
        isFilteredStatus ? currentState.searchQuery : null,
        isFilteredStatus ? currentState.selectedCountries : [],
        isFilteredStatus ? currentState.hourlyBudgetType : null,
        isFilteredStatus ? currentState.priceRange : { from: null, to: null }
      );

      updatedCounts[key] = count;
    });

    await Promise.all(countPromises);
    setTotalCountByStatus(updatedCounts);
  }, [setTotalCountByStatus]);

  const loadMoreTasks = useCallback(
    async (reset = false, specificStatus?: StatusKey) => {
      const currentState = stateRef.current;
      if (currentState.loading && !reset) return;

      const statuses = specificStatus ? [specificStatus] : statusKeyArray;
      let shouldLoadMore = false;

      for (const key of statuses) {
        const currentCount = currentState.tasksByStatus[key].length;
        const totalCount = currentState.totalCountByStatus[key];
        if (
          reset ||
          (currentCount < totalCount && currentState.hasMoreByStatus[key])
        ) {
          shouldLoadMore = true;
          break;
        }
      }

      if (!shouldLoadMore && !reset) return;

      setLoading(true);
      const effectiveLimit = currentState.limit ?? PAGE_SIZE;

      try {
        const fetchPromises = statuses.map(async (key) => {
          const label = statusKeyToStatusLabel(key);
          const page = reset ? 0 : currentState.pageByStatus[key];
          
          const offset = page * effectiveLimit;

          const shouldApplyFilters =
            !currentState.statusFilter || currentState.statusFilter === label;

          const filtered = {
            categoryFilter: shouldApplyFilters
              ? currentState.categoryFilter
              : null,
            subcategoryFilter: shouldApplyFilters
              ? currentState.subcategoryFilter
              : null,
            dateRange: shouldApplyFilters
              ? currentState.dateRange
              : { from: null, to: null },
            searchQuery: shouldApplyFilters ? currentState.searchQuery : null,
            selectedCountries: shouldApplyFilters
              ? currentState.selectedCountries
              : [],
            hourlyBudgetType: shouldApplyFilters
              ? currentState.hourlyBudgetType
              : null,
            priceFrom: shouldApplyFilters ? currentState.priceRange.from : null,
            priceTo: shouldApplyFilters ? currentState.priceRange.to : null,
          };

          const tasks = await fetchTasksByStatus(label, {
            ...filtered,
            limit: currentState.limit ?? PAGE_SIZE,
            offset,
          });

          if (reset) {
            return { key, tasks, page };
          }

          const existingTasks = currentState.tasksByStatus[key];

          dispatch({
            type: "UPDATE_TASKS_FOR_STATUS",
            payload: {
              status: key,
              tasks: [...existingTasks, ...tasks],
            },
          });

          dispatch({
            type: "SET_PAGE_BY_STATUS",
            payload: { status: key, page: page + 1 },
          });

          dispatch({
            type: "SET_HAS_MORE_BY_STATUS",
            payload: { status: key, hasMore: tasks.length === effectiveLimit },
          });

          return { key, tasks, page };
        });

        const results = await Promise.all(fetchPromises);

        if (reset) {
          const newTasksByStatus: Record<StatusKey, Task[]> = {
            "to-do": [],
            "in-progress": [],
            done: [],
          };

          results.forEach(({ key, tasks }) => {
            newTasksByStatus[key] = tasks;
            dispatch({
              type: "SET_PAGE_BY_STATUS",
              payload: { status: key, page: 1 },
            });
            dispatch({
              type: "SET_HAS_MORE_BY_STATUS",
              payload: { status: key, hasMore: tasks.length === effectiveLimit },
            });
          });

          setTasksByStatus(newTasksByStatus);
        }
      } catch (error) {
        console.error("Error in loadMoreTasks:", error);
      } finally {
        setLoading(false);
        if (reset) {
          setFiltersChanged(false);
        }
      }
    },
    [fetchTasksByStatus, setLoading, setTasksByStatus, setFiltersChanged]
  );

  const findColumnOfTask = useCallback((taskId: string): StatusKey | null => {
    const currentState = stateRef.current;
    for (const key of statusKeyArray) {
      if (
        currentState.tasksByStatus[key].some(
          (task) => task.id.toString() === taskId
        )
      ) {
        return key;
      }
    }
    return null;
  }, []);

  const moveTask = useCallback(
    async (
      taskId: string,
      sourceCol: StatusKey,
      destCol: StatusKey,
      destIndex: number
    ) => {
      const currentState = stateRef.current;
      const task = currentState.tasksByStatus[sourceCol].find(
        (t) => t.id.toString() === taskId
      );
      if (!task) return;

      const newSourceTasks = currentState.tasksByStatus[sourceCol].filter(
        (t) => t.id.toString() !== taskId
      );
      const updatedTask: Task = {
        ...task,
        status: statusKeyToStatusLabel(destCol),
      };
      const newDestTasks = currentState.tasksByStatus[destCol].filter(
        (t) => t.id.toString() !== taskId
      );
      newDestTasks.splice(destIndex, 0, updatedTask);

      setTasksByStatus({
        ...currentState.tasksByStatus,
        [sourceCol]: newSourceTasks,
        [destCol]: newDestTasks,
      });

      const { error } = await supabase.rpc("update_task_status", {
        task_id: task.id,
        new_status: updatedTask.status,
      });

      if (error) console.error("Failed to update task status:", error);
      await fetchStatusWiseCounts();
    },
    [setTasksByStatus, fetchStatusWiseCounts]
  );

  const handleRealtimeUpdate = useCallback(
    debounce(() => {
      const currentState = stateRef.current;
      if (!currentState.loading) {
        loadMoreTasks(true);
        fetchStatusWiseCounts();
      }
    }, 1000),
    [loadMoreTasks, fetchStatusWiseCounts]
  );

  useEffect(() => {
    const channel = supabase
      .channel("realtime-projects")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "projects",
        },
        handleRealtimeUpdate
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "projects",
        },
        handleRealtimeUpdate
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [handleRealtimeUpdate]);

  useEffect(() => {
    if (state.filtersChanged) {
      resetPagination();
      loadMoreTasks(true);
      fetchStatusWiseCounts();
    }
  }, [
    state.statusFilter,
    state.categoryFilter,
    state.subcategoryFilter,
    state.dateRange,
    state.searchQuery,
    state.limit,
    state.selectedCountries,
    resetPagination,
    loadMoreTasks,
    fetchStatusWiseCounts,
    state.hourlyBudgetType,
    state.priceRange,
  ]);

  return {
    tasksByStatus: state.tasksByStatus,
    setTasksByStatus,
    statusFilter: state.statusFilter,
    setStatusFilter,
    categoryFilter: state.categoryFilter,
    setCategoryFilter,
    subcategoryFilter: state.subcategoryFilter,
    setSubcategoryFilter,
    dateRange: state.dateRange,
    setDateRange,
    limit: state.limit,
    setLimit,
    loadMoreTasks,
    loading: state.loading,
    hasMoreByStatus: state.hasMoreByStatus,
    pageByStatus: state.pageByStatus,
    resetPagination,
    moveTask,
    findColumnOfTask,
    searchQuery: state.searchQuery,
    setSearchQuery,
    fetchStatusWiseCounts,
    fetchTasksByStatus,
    totalCountByStatus: state.totalCountByStatus,
    statusKeyArray,
    selectedCountries: state.selectedCountries,
    setSelectedCountries,
    countryOptions: state.countryOptions,
    hourlyBudgetType: state.hourlyBudgetType,
    setHourlyBudgetType,
    priceRange: state.priceRange,
    setPriceRange,
    getTaskCountByStatus,
  };
}
