import { useEffect, useState } from "react";
import { AdminLayout } from "../../components/admin/AdminLayout";
import { InstantQuoteSettings } from "../../components/admin/InstantQuoteSettings";
import { useProfile } from "../../context/ProfileContext";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";
import { Save } from "lucide-react";

interface QuoteSettings {
  id?: string;
  org_id?: string | null;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  default_deposit: number;
  xero_enabled: boolean;
}

const DEFAULT_SETTINGS: QuoteSettings = {
  logo_url: "",
  primary_color: "#3b82f6",
  secondary_color: "#1d4ed8",
  default_deposit: 15,
  xero_enabled: false,
};

export function SettingsAdminPage() {
  const { orgId } = useProfile();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [logoUrl, setLogoUrl] = useState(DEFAULT_SETTINGS.logo_url);
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_SETTINGS.primary_color);
  const [secondaryColor, setSecondaryColor] = useState(DEFAULT_SETTINGS.secondary_color);
  const [defaultDeposit, setDefaultDeposit] = useState<number>(DEFAULT_SETTINGS.default_deposit);
  const [xeroEnabled, setXeroEnabled] = useState(DEFAULT_SETTINGS.xero_enabled);

  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      
      // Load local storage fallback first as the base
      let local: QuoteSettings | null = null;
      try {
        const localStr = localStorage.getItem("qsbom-quote-settings");
        if (localStr) {
          local = JSON.parse(localStr);
        }
      } catch (e) {
        console.warn("Failed to parse local quote settings", e);
      }

      if (local) {
        setLogoUrl(local.logo_url || "");
        setPrimaryColor(local.primary_color || "#3b82f6");
        setSecondaryColor(local.secondary_color || "#1d4ed8");
        setDefaultDeposit(typeof local.default_deposit === 'number' ? local.default_deposit : 15);
        setXeroEnabled(!!local.xero_enabled);
      }

      // Try fetching from DB if orgId is loaded
      if (orgId) {
        try {
          const { data, error } = await supabase
            .from("quote_settings")
            .select("*")
            .eq("org_id", orgId)
            .maybeSingle();

          if (error) throw error;
          
          if (data) {
            setLogoUrl(data.logo_url || "");
            setPrimaryColor(data.primary_color || "#3b82f6");
            setSecondaryColor(data.secondary_color || "#1d4ed8");
            setDefaultDeposit(typeof data.default_deposit === 'number' ? data.default_deposit : 15);
            setXeroEnabled(!!data.xero_enabled);

            // Sync to local storage
            localStorage.setItem("qsbom-quote-settings", JSON.stringify({
              org_id: orgId,
              logo_url: data.logo_url || "",
              primary_color: data.primary_color || "#3b82f6",
              secondary_color: data.secondary_color || "#1d4ed8",
              default_deposit: data.default_deposit,
              xero_enabled: !!data.xero_enabled
            }));
          }
        } catch (dbErr) {
          console.warn("Failed to fetch quote settings from DB, using fallback", dbErr);
        }
      }

      setLoading(false);
    }

    loadSettings();
  }, [orgId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      logo_url: logoUrl,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      default_deposit: defaultDeposit,
      xero_enabled: xeroEnabled,
      org_id: orgId || null,
    };

    // Save to localStorage immediately (offline first)
    localStorage.setItem("qsbom-quote-settings", JSON.stringify(payload));

    let dbSuccess = false;
    if (orgId) {
      try {
        const { error } = await supabase
          .from("quote_settings")
          .upsert(payload, { onConflict: "org_id" });

        if (error) throw error;
        dbSuccess = true;
      } catch (dbErr) {
        console.error("Failed to save settings to DB", dbErr);
      }
    }

    setSaving(false);
    if (dbSuccess) {
      toast.success("Settings saved to database and synchronized locally.");
    } else {
      toast.success("Settings saved locally (offline mode).");
    }
  };

  return (
    <AdminLayout
      title="Branding & Quote Settings"
      subtitle="Configure logo, design theme, default deposit, and integration options for quotes."
    >
      {loading ? (
        <div className="text-sm text-brand-muted animate-pulse">Loading settings…</div>
      ) : (
        <>
        <form onSubmit={handleSave} className="max-w-2xl bg-brand-card border border-brand-border rounded-xl p-6 space-y-6 shadow-sm">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1.5">
                Logo URL
              </label>
              <input
                type="text"
                data-testid="setting-logo-url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
                className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted/50 focus:outline-none focus:border-brand-accent transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1.5">
                  Primary Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-10 h-10 p-0 border border-brand-border rounded-md cursor-pointer"
                  />
                  <input
                    type="text"
                    data-testid="setting-primary-color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#3b82f6"
                    className="flex-1 bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted/50 focus:outline-none focus:border-brand-accent transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1.5">
                  Secondary Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-10 h-10 p-0 border border-brand-border rounded-md cursor-pointer"
                  />
                  <input
                    type="text"
                    data-testid="setting-secondary-color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    placeholder="#1d4ed8"
                    className="flex-1 bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted/50 focus:outline-none focus:border-brand-accent transition-colors"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1.5">
                Default Deposit (%)
              </label>
              <input
                type="number"
                data-testid="setting-default-deposit"
                value={defaultDeposit}
                onChange={(e) => setDefaultDeposit(Number(e.target.value))}
                min="0"
                max="100"
                className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted/50 focus:outline-none focus:border-brand-accent transition-colors"
              />
            </div>

            <div className="border-t border-brand-border/60 pt-4">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  data-testid="setting-xero-enabled"
                  checked={xeroEnabled}
                  onChange={(e) => setXeroEnabled(e.target.checked)}
                  className="w-4 h-4 accent-brand-accent border-brand-border rounded focus:ring-brand-accent/40 bg-brand-bg"
                />
                <span className="text-sm font-medium text-brand-text group-hover:text-brand-text-hover transition-colors">
                  Enable Xero Integration
                </span>
              </label>
              <p className="text-xs text-brand-muted mt-1 ml-7">
                Sync generated quotes directly as draft invoices in your connected Xero account.
              </p>
            </div>
          </div>

          <div className="border-t border-brand-border/60 pt-5 flex justify-end">
            <button
              type="submit"
              data-testid="settings-save-btn"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-accent hover:bg-brand-accent-hover text-white text-sm font-semibold rounded-lg transition-colors shadow-sm disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? "Saving…" : "Save Settings"}
            </button>
          </div>
        </form>

        <div className="mt-8">
          <InstantQuoteSettings />
        </div>
        </>
      )}
    </AdminLayout>
  );
}
