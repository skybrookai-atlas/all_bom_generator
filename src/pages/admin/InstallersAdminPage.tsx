import { useEffect, useState } from "react";
import { AdminLayout } from "../../components/admin/AdminLayout";
import { useProfile } from "../../context/ProfileContext";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";

interface Installer {
  id: string;
  org_id: string | null;
  name: string;
  email: string;
  phone: string;
  status: "Active" | "Inactive";
  created_at?: string;
}

export function InstallersAdminPage() {
  const { orgId } = useProfile();
  const [loading, setLoading] = useState(true);
  const [installers, setInstallers] = useState<Installer[]>([]);
  
  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadInstallers() {
      setLoading(true);
      
      // Load from localStorage fallback first
      let local: Installer[] = [];
      try {
        const localStr = localStorage.getItem("qsbom-installers");
        if (localStr) {
          local = JSON.parse(localStr);
        }
      } catch (e) {
        console.warn("Failed to parse local installers", e);
      }
      let initialList = local;
      if (initialList.length === 0) {
        initialList = [{ id: 'john-doe-id', org_id: null, name: 'Installer John Doe', status: 'Active', email: 'john@example.com', phone: '0400000000' }];
      }
      setInstallers(initialList);

      // Fetch from Supabase
      try {
        const { data, error } = await supabase
          .from("installers")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;
        
        if (data && data.length > 0) {
          setInstallers(data as Installer[]);
          // Sync to localStorage
          localStorage.setItem("qsbom-installers", JSON.stringify(data));
        }
      } catch (dbErr) {
        console.warn("Failed to fetch installers from DB, using fallback", dbErr);
      }
      
      setLoading(false);
    }

    loadInstallers();
  }, [orgId]);

  const resetForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setStatus("Active");
    setEditingId(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Installer Name is required");
      return;
    }
    
    setSubmitting(true);

    const isEditing = !!editingId;
    const currentId = editingId || ((typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID)
      ? window.crypto.randomUUID()
      : Math.random().toString(36).substring(2));

    const payload: Installer = {
      id: currentId,
      org_id: orgId || null,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      status,
      created_at: isEditing 
        ? installers.find(i => i.id === currentId)?.created_at 
        : new Date().toISOString()
    };

    // Update local state and localStorage (offline-first)
    let nextInstallers = [...installers];
    if (isEditing) {
      nextInstallers = nextInstallers.map(i => i.id === currentId ? payload : i);
    } else {
      nextInstallers.unshift(payload);
    }
    setInstallers(nextInstallers);
    localStorage.setItem("qsbom-installers", JSON.stringify(nextInstallers));

    // Try DB persistence
    let dbSuccess = false;
    try {
      if (isEditing) {
        const { error } = await supabase
          .from("installers")
          .update({
            name: payload.name,
            email: payload.email,
            phone: payload.phone,
            status: payload.status
          })
          .eq("id", currentId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("installers")
          .insert(payload);
        if (error) throw error;
      }
      dbSuccess = true;
    } catch (dbErr) {
      console.warn("Failed to persist installer change in DB", dbErr);
    }

    setSubmitting(false);
    resetForm();

    if (dbSuccess) {
      toast.success(isEditing ? "Installer updated successfully." : "Installer created successfully.");
    } else {
      toast.success(isEditing ? "Installer updated locally (offline mode)." : "Installer created locally (offline mode).");
    }
  };

  const handleEdit = (installer: Installer) => {
    setEditingId(installer.id);
    setName(installer.name);
    setEmail(installer.email || "");
    setPhone(installer.phone || "");
    setStatus(installer.status);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this installer?")) {
      return;
    }

    // Update local state and localStorage immediately
    const nextInstallers = installers.filter(i => i.id !== id);
    setInstallers(nextInstallers);
    localStorage.setItem("qsbom-installers", JSON.stringify(nextInstallers));

    // Try DB persistence
    let dbSuccess = false;
    try {
      const { error } = await supabase
        .from("installers")
        .delete()
        .eq("id", id);
      if (error) throw error;
      dbSuccess = true;
    } catch (dbErr) {
      console.warn("Failed to delete installer from DB", dbErr);
    }

    if (dbSuccess) {
      toast.success("Installer deleted successfully.");
    } else {
      toast.success("Installer deleted locally (offline mode).");
    }
  };

  return (
    <AdminLayout
      title="Installers Registry"
      subtitle="Manage internal and sub-contracted fence installers."
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form panel */}
        <div className="bg-brand-card border border-brand-border rounded-xl p-5 h-fit space-y-4">
          <h2 className="text-sm font-semibold text-brand-text">
            {editingId ? "Edit Installer" : "Add Installer"}
          </h2>
          
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1.5">
                Full Name *
              </label>
              <input
                type="text"
                data-testid="installer-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Smith"
                required
                className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted/50 focus:outline-none focus:border-brand-accent transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                data-testid="installer-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. john@example.com"
                className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted/50 focus:outline-none focus:border-brand-accent transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1.5">
                Phone Number
              </label>
              <input
                type="text"
                data-testid="installer-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 0400 123 456"
                className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted/50 focus:outline-none focus:border-brand-accent transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1.5">
                Status
              </label>
              <select
                data-testid="installer-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as "Active" | "Inactive")}
                className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-text focus:outline-none focus:border-brand-accent transition-colors cursor-pointer"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="submit"
                data-testid="installer-save-btn"
                disabled={submitting}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-brand-accent hover:bg-brand-accent-hover text-white text-sm font-semibold rounded-lg transition-colors shadow-sm disabled:opacity-50"
              >
                {editingId ? "Update Installer" : "Add Installer"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3 py-2 text-xs text-brand-muted hover:text-brand-text border border-brand-border rounded-lg hover:bg-brand-border/20 transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* List panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-brand-muted uppercase tracking-wider">
              Registered Installers ({installers.length})
            </h2>
          </div>

          <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-8 text-center text-sm text-brand-muted animate-pulse">
                Loading installers…
              </div>
            ) : installers.length === 0 ? (
              <div className="p-8 text-center text-sm text-brand-muted">
                No installers registered yet. Use the form to add one.
              </div>
            ) : (
              <div className="divide-y divide-brand-border/60">
                {installers.map((installer) => (
                  <div
                    key={installer.id}
                    data-testid="installer-list-row"
                    className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-brand-bg/40 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-brand-text">
                          {installer.name}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            installer.status === "Active"
                              ? "text-emerald-400 bg-emerald-500/10"
                              : "text-brand-muted bg-brand-border/30"
                          }`}
                        >
                          {installer.status}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1 text-xs text-brand-muted">
                        {installer.email && <span>{installer.email}</span>}
                        {installer.phone && (
                          <span className="hidden sm:inline text-brand-border/60">|</span>
                        )}
                        {installer.phone && <span>{installer.phone}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        type="button"
                        data-testid="edit-installer-btn"
                        onClick={() => handleEdit(installer)}
                        className="p-1.5 text-brand-muted hover:text-brand-accent hover:bg-brand-border/20 rounded transition-colors"
                        title="Edit installer"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        data-testid="delete-installer-btn"
                        onClick={() => handleDelete(installer.id)}
                        className="p-1.5 text-brand-muted hover:text-brand-danger hover:bg-brand-border/20 rounded transition-colors"
                        title="Delete installer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
