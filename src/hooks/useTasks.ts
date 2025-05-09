import { useReducer, useCallback, useEffect } from "react";
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
  | { type: "RESET_PAGINATION" };

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
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_TASKS_BY_STATUS":
      return { ...state, tasksByStatus: action.payload };
    case "SET_STATUS_FILTER":
      return { ...state, statusFilter: action.payload };
    case "SET_CATEGORY_FILTER":
      return { ...state, categoryFilter: action.payload };
    case "SET_SUBCATEGORY_FILTER":
      return { ...state, subcategoryFilter: action.payload };
    case "SET_DATE_RANGE":
      return { ...state, dateRange: action.payload };
    case "SET_LIMIT":
      return { ...state, limit: action.payload };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_SEARCH_QUERY":
      return { ...state, searchQuery: action.payload };
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
    default:
      return state;
  }
}

const statusKeyToStatusLabel = (key: StatusKey) =>
  key === "to-do" ? "To Do" : key === "in-progress" ? "In Progress" : "Done";

export function useTasks() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const pageSize = 10;

  const setTasksByStatus = (val: Record<StatusKey, Task[]>) =>
    dispatch({ type: "SET_TASKS_BY_STATUS", payload: val });
  const setStatusFilter = (val: string | null) =>
    dispatch({ type: "SET_STATUS_FILTER", payload: val });
  const setCategoryFilter = (val: string | null) =>
    dispatch({ type: "SET_CATEGORY_FILTER", payload: val });
  const setSubcategoryFilter = (val: string | null) =>
    dispatch({ type: "SET_SUBCATEGORY_FILTER", payload: val });
  const setDateRange = (val: { from: string | null; to: string | null }) =>
    dispatch({ type: "SET_DATE_RANGE", payload: val });
  const setLimit = (val: number | null) =>
    dispatch({ type: "SET_LIMIT", payload: val });
  const setLoading = (val: boolean) =>
    dispatch({ type: "SET_LOADING", payload: val });
  const setSearchQuery = (val: string | null) =>
    dispatch({ type: "SET_SEARCH_QUERY", payload: val });
  const resetPagination = () => dispatch({ type: "RESET_PAGINATION" });
  const setTotalCountByStatus = (val: Record<StatusKey, number>) =>
    dispatch({ type: "SET_TOTAL_COUNT_BY_STATUS", payload: val });

  const fetchTasksByStatus = async (
    status: string,
    filters: {
      categoryFilter?: string | null;
      subcategoryFilter?: string | null;
      dateRange?: { from: string | null; to: string | null };
      searchQuery?: string | null;
      limit?: number | null;
      offset?: number;
    },
    reset = false
  ): Promise<Task[]> => {
    const offset = filters.offset ?? 0;
    const limitCount = filters.limit ?? state.limit ?? pageSize;

    const { data, error } = await supabase.rpc("get_tasks_by_status", {
      task_status: status,
      category_filter: filters.categoryFilter,
      subcategory_filter: filters.subcategoryFilter,
      date_from: filters.dateRange?.from,
      date_to: filters.dateRange?.to,
      limit_count: limitCount,
      offset_count: offset,
      search_query: filters.searchQuery,
    });

    return !error && data ? (data as Task[]) : [];
  };

  const loadMoreTasks = useCallback(
    async (reset = false, specificStatus?: StatusKey) => {
      setLoading(true);

      const statuses = specificStatus ? [specificStatus] : statusKeyArray;

      const newTasksByStatus: Record<StatusKey, Task[]> = reset
        ? { "to-do": [], "in-progress": [], done: [] }
        : { ...state.tasksByStatus };

        for (const key of statuses) {
          const label = statusKeyToStatusLabel(key);
          const page = reset ? 0 : state.pageByStatus[key];
          const offset = page * (state.limit ?? pageSize);
        
          let filtered = {
            categoryFilter: null,
            subcategoryFilter: null,
            dateRange: { from: null, to: null },
            searchQuery: null,
          };
        
          if (!state.statusFilter || state.statusFilter === label) {
            filtered = {
              categoryFilter: state.categoryFilter,
              subcategoryFilter: state.subcategoryFilter,
              dateRange: state.dateRange,
              searchQuery: state.searchQuery,
            };
          }
        
          const fetched = await fetchTasksByStatus(
            label,
            {
              ...filtered,
              limit: state.limit,
              offset,
            },
            reset
          );
        
          newTasksByStatus[key] = reset
            ? fetched
            : [...(state.tasksByStatus[key] || []), ...fetched];
        
          dispatch({
            type: "SET_PAGE_BY_STATUS",
            payload: { status: key, page: page + 1 },
          });
        
          dispatch({
            type: "SET_HAS_MORE_BY_STATUS",
            payload: { status: key, hasMore: fetched.length > 0 },
          });
        }        

      setTasksByStatus(newTasksByStatus);
      setLoading(false);
    },
    [state]
  );

  const moveTask = async (
    taskId: string,
    sourceCol: StatusKey,
    destCol: StatusKey,
    destIndex: number
  ) => {
    const task = state.tasksByStatus[sourceCol].find(
      (t) => t.id.toString() === taskId
    );
    if (!task) return;

    const newSourceTasks = state.tasksByStatus[sourceCol].filter(
      (t) => t.id.toString() !== taskId
    );
    const updatedTask: Task = {
      ...task,
      status: statusKeyToStatusLabel(destCol),
    };
    const newDestTasks = state.tasksByStatus[destCol].filter(
      (t) => t.id.toString() !== taskId
    );
    newDestTasks.splice(destIndex, 0, updatedTask);

    setTasksByStatus({
      ...state.tasksByStatus,
      [sourceCol]: newSourceTasks,
      [destCol]: newDestTasks,
    });

    const { error } = await supabase.rpc("update_task_status", {
      task_id: task.id,
      new_status: updatedTask.status,
    });

    if (error) console.error("Failed to update task status:", error);
    await fetchStatusWiseCounts();
  };

  const findColumnOfTask = (taskId: string): StatusKey | null => {
    for (const key of statusKeyArray) {
      if (
        state.tasksByStatus[key].some((task) => task.id.toString() === taskId)
      ) {
        return key;
      }
    }
    return null;
  };

  const fetchStatusWiseCounts = useCallback(async () => {
    const statusLabels: Record<StatusKey, string> = {
      "to-do": "To Do",
      "in-progress": "In Progress",
      done: "Done",
    };

    const counts: Record<StatusKey, number> = {
      "to-do": 0,
      "in-progress": 0,
      done: 0,
    };

    for (const key of statusKeyArray) {
      let query = supabase
        .from("projects")
        .select("*", { count: "exact", head: true })
        .eq("status", statusLabels[key]);

      if (!state.statusFilter || state.statusFilter === statusLabels[key]) {
        if (state.categoryFilter)
          query = query.eq("category", state.categoryFilter);
        if (state.subcategoryFilter)
          query = query.eq("subcategory", state.subcategoryFilter);
        if (state.dateRange?.from && state.dateRange?.to) {
          query = query
            .gte("created_at", state.dateRange.from)
            .lte("created_at", state.dateRange.to);
        }
        if (state.searchQuery)
          query = query.ilike("title", `%${state.searchQuery}%`);
      }

      const { count } = await query;
      if (typeof count === "number") counts[key] = count;
    }

    setTotalCountByStatus(counts);
  }, [state]);

  const debouncedRealtimeUpdate = debounce(() => {
    loadMoreTasks(true);
    fetchStatusWiseCounts();
  }, 300);

  useEffect(() => {
    const channel = supabase
      .channel("realtime-projects")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "projects",
        },
        () => {
          debouncedRealtimeUpdate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      debouncedRealtimeUpdate.cancel();
    };
  }, []);

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
    totalCountByStatus: state.totalCountByStatus,
    statusKeyArray,
  };
}
