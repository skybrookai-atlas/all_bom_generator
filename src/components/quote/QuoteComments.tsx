import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { Send, MessageSquare, ShieldCheck, User, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface QuoteComment {
  id: string;
  quote_id: string;
  author_name: string;
  comment_text: string;
  is_staff: boolean;
  is_private?: boolean;
  created_at: string;
}

interface QuoteCommentsProps {
  quoteId: string;
  currentUser?: { email: string; name?: string; role?: string } | null;
  clientName?: string;
  orgId?: string;
}

export function QuoteComments({ quoteId, currentUser, clientName = "Client", orgId }: QuoteCommentsProps) {
  const [comments, setComments] = useState<QuoteComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [authorName, setAuthorName] = useState(currentUser?.name || "");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const isStaff = !!currentUser;

  // Load initial comments
  useEffect(() => {
    async function fetchComments() {
      try {
        let query = supabase
          .from("quote_comments")
          .select("*")
          .eq("quote_id", quoteId);

        if (orgId) {
          query = query.eq("org_id", orgId);
        }

        query = query.order("created_at", { ascending: true });

        if (!isStaff) {
          query = query.eq("is_private", false);
        }

        const { data, error } = await query;

        if (error) throw error;
        setComments(data || []);
      } catch (error) {
        console.error("Failed to load comments:", error);
      } finally {
        setLoading(false);
      }
    }

    void fetchComments();
  }, [quoteId, isStaff, orgId]);

  // Subscribe to real-time additions
  useEffect(() => {
    const channel = supabase
      .channel(`quote_comments_realtime_${quoteId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "quote_comments",
          filter: `quote_id=eq.${quoteId}`,
        },
        (payload) => {
          const newItem = payload.new as QuoteComment;
          if (!isStaff && newItem.is_private) return;
          setComments((prev) => {
            // Prevent double additions if we sent it ourselves
            if (prev.some((c) => c.id === newItem.id)) return prev;
            return [...prev, newItem];
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [quoteId]);

  // Scroll to bottom on new comments
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    // Check if name is provided for public users
    const finalAuthorName = isStaff
      ? currentUser?.name || currentUser?.email || "Staff"
      : authorName.trim() || clientName || "Client";

    if (!finalAuthorName) {
      toast.error("Please enter your name before posting.");
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase
        .from("quote_comments")
        .insert({
          quote_id: quoteId,
          author_name: finalAuthorName,
          comment_text: newComment.trim(),
          is_staff: isStaff,
          org_id: orgId,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setComments((prev) => [...prev, data as QuoteComment]);
      }
      setNewComment("");
      if (!isStaff) {
        // Stash client name in local storage
        localStorage.setItem("quote_portal_client_name", finalAuthorName);
      }
    } catch (error) {
      toast.error("Failed to post comment.");
      console.error(error);
    } finally {
      setSending(false);
    }
  };

  // Hydrate client name from local storage if not staff
  useEffect(() => {
    if (!isStaff) {
      const savedName = localStorage.getItem("quote_portal_client_name");
      if (savedName) setAuthorName(savedName);
    }
  }, [isStaff]);

  return (
    <div className="flex flex-col h-[400px] border border-brand-border/40 rounded-2xl bg-brand-bg/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center space-x-2 px-5 py-3 border-b border-brand-border/40 bg-brand-bg/40">
        <MessageSquare size={18} className="text-brand-primary" />
        <h3 className="font-bold text-sm uppercase tracking-wider text-brand-text">
          Discussion & Questions
        </h3>
      </div>

      {/* Message List */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="animate-spin text-brand-primary" size={24} />
          </div>
        ) : comments.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8">
            <MessageSquare size={36} className="text-brand-muted/30 mb-2" />
            <p className="text-sm font-semibold text-brand-muted">No comments yet</p>
            <p className="text-xs text-brand-muted/60 mt-1 max-w-xs">
              Have questions about pricing, dimensions, or accessories? Type them below to chat with the supplier.
            </p>
          </div>
        ) : (
          comments
            .filter((comment) => isStaff || !comment.is_private)
            .map((comment) => (
            <div
              key={comment.id}
              className={`flex flex-col space-y-1 max-w-[85%] ${
                comment.is_staff === isStaff ? "ml-auto items-end" : "mr-auto items-start"
              }`}
            >
              {/* Author name & date */}
              <div className="flex items-center space-x-1.5 text-xs text-brand-muted px-1">
                <span className="font-semibold text-brand-text/80">{comment.author_name}</span>
                {comment.is_staff && (
                  <span className="inline-flex items-center px-1 py-0.5 rounded text-[10px] font-bold bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
                    <ShieldCheck size={10} className="mr-0.5" />
                    Supplier
                  </span>
                )}
                <span>•</span>
                <span>{new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>

              {/* Message Bubble */}
              <div
                className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  comment.is_staff === isStaff
                    ? "bg-brand-primary text-white rounded-tr-none shadow-md shadow-brand-primary/15"
                    : "bg-brand-border/30 text-brand-text border border-brand-border/40 rounded-tl-none"
                }`}
              >
                {comment.comment_text}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="border-t border-brand-border/40 p-3 bg-brand-bg/40 flex flex-col space-y-2">
        {/* Name input for guest/client users */}
        {!isStaff && !localStorage.getItem("quote_portal_client_name") && (
          <div className="flex items-center space-x-2 pb-2 border-b border-brand-border/20">
            <User size={14} className="text-brand-muted" />
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Your Name"
              required
              className="bg-transparent text-xs text-brand-text placeholder-brand-text/30 outline-none w-full font-semibold"
            />
          </div>
        )}

        <div className="flex space-x-2 items-center">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Type your question or message..."
            className="flex-1 px-4 py-2 rounded-xl border border-brand-border/40 bg-brand-bg/50 text-brand-text placeholder-brand-text/30 text-sm outline-none focus:border-brand-primary transition-all font-semibold"
          />
          <button
            type="submit"
            disabled={sending || !newComment.trim()}
            className="p-2.5 rounded-xl bg-brand-primary text-white hover:bg-brand-primary-hover disabled:opacity-40 disabled:pointer-events-none transition-all shadow-md shadow-brand-primary/10"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </form>
    </div>
  );
}
