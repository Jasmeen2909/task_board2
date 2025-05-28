import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Dialog, DialogPanel, Transition } from "@headlessui/react";
import { toast } from "react-hot-toast";
import { Comment } from "../types/comments";
import { askAIForTask } from "../services/aiSuggestions";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye } from "@fortawesome/free-solid-svg-icons";
import { useLoader } from "../context/LoaderContext";
import { Task } from "../types/tasks";

interface TaskDetailsModalProps {
  taskId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (updatedTask: Task) => void;
}

export default function TaskDetailsModal({
  taskId,
  isOpen,
  onClose,
  onStatusChange,
}: TaskDetailsModalProps) {
  const [task, setTask] = useState<any>(null);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComment, setLoadingComment] = useState(false);
  const [editingLoading, setEditingLoading] = useState(false);

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [commentIdToDelete, setCommentIdToDelete] = useState<string | null>(
    null
  );
  const { setLoading } = useLoader();
  const [loadingTask, setLoadingTask] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    fetchUser();
  }, []);

  const handleAskAI = async () => {
    setAiLoading(true);
    try {
      const suggestion = await askAIForTask(task);
      setAiAnswer(suggestion);
    } catch (e) {
      toast.error("AI suggestion failed");
    } finally {
      setAiLoading(false);
    }
  };

  const handleCloseSuggestion = () => setAiAnswer(null);

  useEffect(() => {
    if (taskId && isOpen) {
      fetchTaskDetails();
      fetchComments();
      setAiAnswer(null);
    }
  }, [taskId, isOpen]);

  useEffect(() => {
    if (!taskId || !isOpen) return;

    const channel = supabase
      .channel("realtime-comments")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "comments",
          filter: `task_id=eq.${taskId}`,
        },
        () => fetchComments()
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "comments",
          filter: `task_id=eq.${taskId}`,
        },
        () => fetchComments()
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "comments",
          filter: `task_id=eq.${taskId}`,
        },
        () => fetchComments()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId, isOpen]);

  useEffect(() => {
    if (!taskId || !isOpen) return;

    const channel = supabase
      .channel("realtime-task-details")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "projects",
          filter: `id=eq.${taskId}`,
        },
        () => fetchTaskDetails()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId, isOpen]);

  const fetchTaskDetails = async () => {
    setLoadingTask(true);
    const { data, error } = await supabase.rpc("get_task_detail", {
      task_id: taskId,
    });
    if (!error && data && data.length > 0) {
      setTask(data[0]);
    }
    setLoadingTask(false);
  };

  const formatDateToIST = (dateStr: string) => {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(dateStr));
  };

  const handleStatusChange = async (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newStatus = e.target.value;

    setLoading(true);
    const { error } = await supabase
      .from("projects")
      .update({ status: newStatus })
      .eq("id", taskId);
    setLoading(false);

    if (!error) {
      const updatedTask = { ...task, status: newStatus };
      setTask(updatedTask);
      toast.success("Status updated!");
      if (onStatusChange) onStatusChange(updatedTask);
    } else {
      toast.error("Failed to update status");
    }
  };

  const fetchComments = async () => {
    const { data, error } = await supabase
      .from("comments")
      .select(
        "id, content, created_at, updated_at, user_id, user_email, parent_id"
      )
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });

    if (!error && data) setComments(data);
  };

  const handleAddComment = async () => {
    setLoadingComment(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("comments").insert([
      {
        task_id: taskId,
        content: comment,
        user_id: user?.id,
        user_email: user?.email || "Anonymous",
        parent_id: null,
      },
    ]);

    if (!error) {
      setComment("");
      toast.success("Comment added!");
      fetchComments();
    } else {
      toast.error("Failed to add comment");
    }
    setLoadingComment(false);
  };

  const confirmDelete = (id: string) => {
    setCommentIdToDelete(id);
    setShowDeleteModal(true);
  };

  const cancelDelete = () => {
    setCommentIdToDelete(null);
    setShowDeleteModal(false);
  };

  const proceedToDelete = () => {
    if (commentIdToDelete) {
      handleDeleteComment(commentIdToDelete);
      setShowDeleteModal(false);
      setCommentIdToDelete(null);
    }
  };

  const handleDeleteComment = async (id: string) => {
    setLoading(true);
    const { error } = await supabase.from("comments").delete().eq("id", id);
    setLoading(false);

    if (!error) {
      toast.success("Comment deleted");
      fetchComments();
    } else {
      toast.error("Failed to delete comment");
    }
  };

  const handleStartEdit = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditingContent(comment.content);
  };

  const handleSaveEdit = async (id: string) => {
    setEditingLoading(true);
    const { error } = await supabase
      .from("comments")
      .update({ content: editingContent, updated_at: new Date().toISOString() })
      .eq("id", id);
    setEditingLoading(false);

    if (!error) {
      toast.success("Comment updated!");
      setEditingCommentId(null);
      setEditingContent("");
      fetchComments();
    } else {
      toast.error("Failed to update comment");
    }
  };

  const renderComments = (parentId: string | null = null) =>
    comments
      .filter((c) => c.parent_id === parentId)
      .map((c) => (
        <div key={c.id} className="rounded p-2 mt-2">
          <div className="text-sm font-semibold">{c.user_email}</div>
          {editingCommentId === c.id ? (
            <div>
              <textarea
                className="w-full border rounded p-2 text-sm mb-1"
                value={editingContent}
                onChange={(e) => setEditingContent(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  className="bg-blue-500 text-white px-3 py-1 rounded text-xs disabled:opacity-50"
                  onClick={() => handleSaveEdit(c.id)}
                  disabled={editingLoading || editingContent.trim() === ""}
                >
                  {editingLoading ? "Saving..." : "Save"}
                </button>

                <button
                  className="text-xs text-gray-600 hover:text-black"
                  onClick={() => setEditingCommentId(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-700 whitespace-pre-line">
                {c.content}
              </p>
              <span className="text-xs text-gray-400">
                {formatDateToIST(c.created_at)}
                {c.updated_at && " (edited)"}
              </span>

              {currentUserId === c.user_id && (
                <div className="mt-1 flex gap-2 text-xs">
                  <button
                    className="hover:underline"
                    onClick={() => handleStartEdit(c)}
                  >
                    Edit
                  </button>
                  <button
                    className="hover:underline"
                    onClick={() => confirmDelete(c.id)}
                  >
                    Delete
                  </button>
                </div>
              )}
            </>
          )}
          <div className="pl-6">{renderComments(c.id)}</div>
        </div>
      ));

  if (loadingTask || !task) {
    return (
      <div className="fixed inset-0 z-50 backdrop-blur-sm flex justify-center items-center">
        <div className="w-12 h-12 border-4 border-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Transition appear show={isOpen}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <div className="fixed inset-0 backdrop-blur-sm" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="bg-white rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.5)] p-4 sm:p-6 w-full max-w-5xl h-full sm:h-auto overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold">{task.title}</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-black"
              >
                &times;
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="order-2 lg:order-1 col-span-1 lg:col-span-2">
                <div className="max-h-[75vh] overflow-y-auto pr-2">
                  <h3 className="font-semibold mb-1">Description</h3>
                  <div className="text-sm text-gray-700 whitespace-pre-line mb-4 overflow-y-auto rounded p-2">
                    {task.description}
                  </div>
                  <button
                    onClick={handleAskAI}
                    disabled={aiLoading}
                    className="mt-4 mb-1 flex items-center gap-2 font-semibold border border-orange-600 rounded text-orange-600 pl-3 pr-3 pt-1 pb-1 hover:text-white hover:bg-orange-600"
                  >
                    <FontAwesomeIcon icon={faEye} />{" "}
                    {aiLoading ? "Generating..." : "Write with AI"}
                  </button>
                  {aiAnswer && (
                    <div className="relative rounded border border-gray-300 p-3 text-sm leading-6 mb-4">
                      <button
                        onClick={handleCloseSuggestion}
                        className="absolute top-2 right-2 text-gray-400 hover:text-black text-sm"
                        aria-label="Close suggestion"
                      >
                        &times;
                      </button>
                      <h4 className="mb-2 font-semibold">AI suggestion</h4>
                      <p className="text-gray-700 text-sm whitespace-pre-line">
                        {aiAnswer}
                      </p>
                    </div>
                  )}
                  <h4 className="font-semibold mt-4 mb-2">Comments</h4>
                  <textarea
                    className="w-full border border-gray-300 rounded p-2 text-sm mb-2"
                    placeholder="Add Comment..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      className="bg-orange-600 text-white px-4 py-1 rounded text-sm disabled:opacity-50"
                      onClick={handleAddComment}
                      disabled={loadingComment || !comment.trim()}
                    >
                      {loadingComment ? "Saving..." : "Save"}
                    </button>

                    <button
                      className="text-sm text-gray-600 hover:text-black"
                      onClick={() => setComment("")}
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="mt-4 space-y-3">{renderComments()}</div>
                </div>
              </div>

              <div className="order-1 lg:order-2 col-span-1 w-full">
                <h3 className="font-semibold mb-4">Details</h3>
                <div className="bg-white rounded-lg border border-gray-200 px-4 sm:px-6 py-5 w-full">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="font-medium text-base">Status</span>
                    <select
                      value={task.status}
                      onChange={handleStatusChange}
                      className="border border-gray-300 rounded-lg px-3 py-1 text-sm font-medium focus:outline-none"
                      style={{ minWidth: 110 }}
                    >
                      <option value="To Do">To Do</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Done">Done</option>
                      <option value="Discarded">Discarded</option>
                    </select>
                  </div>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between gap-x-12">
                      <span className="mr-8">Amount Raw Value</span>
                      <span className="font-normal">
                        {task.amount_rawValue ?? "-"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-x-12">
                      <span className="mr-8">Amount Display Value</span>
                      <span className="font-normal">
                        {task.amount_displayValue ?? "-"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-x-12">
                      <span className="mr-8">Hourly Budget Type</span>
                      <span className="font-normal">
                        {task.hourlyBudgetType ?? "-"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-x-12">
                      <span className="mr-8">Hourly Budget Min Value</span>
                      <span className="font-normal">
                        {task.hourlyBudgetMin_rawValue ?? "-"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-x-12">
                      <span className="mr-8">Hourly Budget Max Value</span>
                      <span className="font-normal">
                        {task.hourlyBudgetMax_rawValue ?? "-"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-x-12">
                      <span className="mr-8">Total Applicant</span>
                      <span className="font-normal">
                        {task.totalApplicants ?? "-"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-x-12">
                      <span className="mr-8">Willing To Hire</span>
                      <span className="font-normal">
                        {task.willingToHire ?? "-"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {showDeleteModal && (
              <div className="fixed inset-0 backdrop-blur-sm z-5 flex items-center justify-center">
                <div className="bg-white rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.1)] border-gray-500 p-6 w-full max-w-sm">
                  <h3 className="text-lg font-semibold mb-4">
                    Confirm Deletion
                  </h3>
                  <p className="text-sm text-gray-700 mb-6">
                    Are you sure you want to delete this comment? This action
                    cannot be undone.
                  </p>
                  <div className="flex justify-end gap-2">
                    <button
                      className="px-4 py-2 text-sm bg-gray-100 text-gray-800 rounded hover:bg-gray-200"
                      onClick={cancelDelete}
                    >
                      Cancel
                    </button>
                    <button
                      className="px-4 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                      onClick={proceedToDelete}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </DialogPanel>
        </div>
      </Dialog>
    </Transition>
  );
}
