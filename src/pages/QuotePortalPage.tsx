import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useQuote } from "../hooks/useQuote";
import { QuoteComments } from "../components/quote/QuoteComments";
import { suggestAccessories } from "../lib/suggestedAccessories";
import { DEFAULT_BRAND } from "../lib/brand";
import { BrandLogo } from "../components/brand/BrandLogo";
import type { BOMLineItem } from "../types/bom.types";
import {
  CheckCircle,
  Clock,
  MapPin,
  Calendar,
  AlertTriangle,
  FileText,
  Lock,
  ArrowLeft,
  Copy,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

/** Row from the anon-readable quote_line_items_public view — client-safe fields only. */
interface PublicLineItem {
  id: string;
  quote_id: string;
  sort_order: number;
  kind: string;
  title: string;
  description: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  is_optional: boolean;
  image_url: string | null;
}

export function QuotePortalPage() {
  const { quoteId } = useParams<{ quoteId: string }>();
  const quoteQuery = useQuote(quoteId);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [activeOptionalSkus, setActiveOptionalSkus] = useState<Set<string>>(new Set());
  const [accepting, setAccepting] = useState(false);
  const [acceptanceDetails, setAcceptanceDetails] = useState<any | null>(null);
  const [loadingAcceptance, setLoadingAcceptance] = useState(true);
  const [signatoryEmail, setSignatoryEmail] = useState("client@example.com");
  const [localAccepted, setLocalAccepted] = useState(false);

  // Dual Signature Pad States
  const canvasRefA = useRef<HTMLCanvasElement | null>(null);
  const canvasRefB = useRef<HTMLCanvasElement | null>(null);
  const [signedA, setSignedA] = useState(false);
  const [signedB, setSignedB] = useState(false);
  const isDrawingRefA = useRef(false);
  const isDrawingRefB = useRef(false);

  const [customQuantities, setCustomQuantities] = useState<Record<string, number>>({});
  const [depositPercent, setDepositPercent] = useState<number>(15);
  // Anon portal cannot read organisations (RLS) — brand from quote_settings + DEFAULT_BRAND.
  const [portalLogoUrl, setPortalLogoUrl] = useState<string>(DEFAULT_BRAND.logoUrl);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const quote = quoteQuery.data?.quote;
  const payload = quoteQuery.data?.payload;
  const isAccepted = quote?.status === "accepted" || localAccepted;

  // Line items from the anon-safe public view (only rows for sent/accepted quotes).
  // NEVER query the quote_line_items base table here — internal costs live there.
  const publicLineItemsQuery = useQuery({
    queryKey: ["quote-line-items-public", quoteId],
    enabled: !!quoteId,
    retry: false,
    queryFn: async (): Promise<PublicLineItem[]> => {
      try {
        const { data, error } = await supabase
          .from("quote_line_items_public")
          .select(
            "id, quote_id, sort_order, kind, title, description, quantity, unit, unit_price, is_optional, image_url",
          )
          .eq("quote_id", quoteId!)
          .order("sort_order", { ascending: true });
        if (error) throw error;
        return (data ?? []) as PublicLineItem[];
      } catch (err) {
        console.warn("[QuotePortalPage] public line items unavailable", err);
        return [];
      }
    },
  });
  const publicLineItems = publicLineItemsQuery.data ?? [];
  const hasLineItems = publicLineItems.length > 0;
  const [activeOptionalLineIds, setActiveOptionalLineIds] = useState<Set<string>>(
    new Set(),
  );

  const handleToggleOptionalLine = (id: string) => {
    if (isAccepted) return;
    setActiveOptionalLineIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const lineItemTotals = useMemo(() => {
    // heading/text rows are document structure — never priced.
    const pricedItems = publicLineItems.filter(
      (item) => item.kind !== "heading" && item.kind !== "text",
    );
    const baseTotal = pricedItems
      .filter((item) => !item.is_optional)
      .reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const optionalTotal = pricedItems
      .filter((item) => item.is_optional && activeOptionalLineIds.has(item.id))
      .reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const subtotal = baseTotal + optionalTotal;
    const gst = subtotal * 0.1;
    return { subtotal, gst, grandTotal: subtotal + gst };
  }, [publicLineItems, activeOptionalLineIds]);

  const getCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement
  ) => {
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ("touches" in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const handleStartA = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRefA.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const coords = getCoordinates(e, canvas);
    if (!coords) return;
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    isDrawingRefA.current = true;
  };

  const handleDrawA = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawingRefA.current) return;
    const canvas = canvasRefA.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const coords = getCoordinates(e, canvas);
    if (!coords) return;
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    setSignedA(true);
  };

  const handleStopA = () => {
    isDrawingRefA.current = false;
  };

  const handleStartB = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRefB.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const coords = getCoordinates(e, canvas);
    if (!coords) return;
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    isDrawingRefB.current = true;
  };

  const handleDrawB = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawingRefB.current) return;
    const canvas = canvasRefB.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const coords = getCoordinates(e, canvas);
    if (!coords) return;
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    setSignedB(true);
  };

  const handleStopB = () => {
    isDrawingRefB.current = false;
  };

  const clearA = () => {
    const canvas = canvasRefA.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignedA(false);
  };
  const clearB = () => {
    const canvas = canvasRefB.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignedB(false);
  };

  useEffect(() => {
    [canvasRefA.current, canvasRefB.current].forEach((canvas) => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width || 400;
      canvas.height = rect.height || 128;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.strokeStyle = "#38bdf8"; // sky-400
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    });
  }, [quote, isAccepted]);

  // Fetch logged-in user profile (if any) to check if staff
  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, role")
          .eq("id", user.id)
          .single();
        setCurrentUser(profile ? { ...user, name: profile.full_name, role: profile.role } : user);
      }
    }
    void getUser();
  }, []);

  useEffect(() => {
    if (quote) {
      try {
        const stored = localStorage.getItem("qsbom-quotes");
        const list = stored ? JSON.parse(stored) : [];
        if (Array.isArray(list)) {
          const exists = list.some((q: any) => q.id === quote.id);
          if (!exists) {
            list.push(quote);
            localStorage.setItem("qsbom-quotes", JSON.stringify(list));
          }
        }
      } catch (e) {
        console.warn("Failed to seed mock quote to localStorage", e);
      }
    }
  }, [quote]);

  // Fetch acceptance info if quote is accepted
  useEffect(() => {
    if (!quoteId || quote?.status !== "accepted") {
      setLoadingAcceptance(false);
      return;
    }

    async function fetchAcceptance() {
      try {
        const { data, error } = await supabase
          .from("quote_acceptances")
          .select("*")
          .eq("quote_id", quoteId)
          .single();
        if (error && error.code !== "PGRST116") throw error; // PGRST116 is "no rows found"
        if (data) {
          setAcceptanceDetails(data);
        } else {
          // fallback to check local storage
          const stored = localStorage.getItem("qsbom-quotes");
          if (stored) {
            const list = JSON.parse(stored);
            const found = list.find((q: any) => q.id === quoteId);
            if (found && found.status === "accepted") {
              setAcceptanceDetails({
                accepted_by: found.contact?.fullName || "Client Dual Signature",
                email: found.contact?.email || "client@example.com",
                signature_data: found.signature_data,
                signature_data_b: found.signature_data_b,
                ip_address: "Local Client",
                created_at: found.updated_at
              });
            }
          }
        }
      } catch (error) {
        console.error("Failed to load acceptance details:", error);
        try {
          const stored = localStorage.getItem("qsbom-quotes");
          if (stored) {
            const list = JSON.parse(stored);
            const found = list.find((q: any) => q.id === quoteId);
            if (found && found.status === "accepted") {
              setAcceptanceDetails({
                accepted_by: found.contact?.fullName || "Client Dual Signature",
                email: found.contact?.email || "client@example.com",
                signature_data: found.signature_data,
                signature_data_b: found.signature_data_b,
                ip_address: "Local Client",
                created_at: found.updated_at
              });
            }
          }
        } catch (_) {}
      } finally {
        setLoadingAcceptance(false);
      }
    }
    void fetchAcceptance();
  }, [quoteId, quote?.status]);

  useEffect(() => {
    if (quote && quote.bom && quote.bom.fenceItems) {
      const initialQtys: Record<string, number> = {};
      (quote.bom.fenceItems as BOMLineItem[]).forEach((item) => {
        if (item.sku && (item.sku.startsWith("CUSTOM-") || item.notes?.includes("manually"))) {
          initialQtys[item.sku] = item.quantity;
        }
      });
      setCustomQuantities(initialQtys);
    }
  }, [quote]);

  useEffect(() => {
    async function loadSettings() {
      let localPercent = 15;
      try {
        const localStr = localStorage.getItem("qsbom-quote-settings");
        if (localStr) {
          const local = JSON.parse(localStr);
          if (typeof local?.default_deposit === "number") {
            localPercent = local.default_deposit;
          }
          if (typeof local?.logo_url === "string" && local.logo_url.trim()) {
            setPortalLogoUrl(local.logo_url);
          }
        }
      } catch (e) {
        console.warn("Failed to parse local quote settings", e);
      }
      setDepositPercent(localPercent);

      if (quote?.org_id) {
        try {
          const { data } = await supabase
            .from("quote_settings")
            .select("default_deposit, logo_url")
            .eq("org_id", quote.org_id)
            .maybeSingle();
          if (data && typeof data.default_deposit === "number") {
            setDepositPercent(data.default_deposit);
          }
          if (data && typeof data.logo_url === "string" && data.logo_url.trim()) {
            setPortalLogoUrl(data.logo_url);
          }
        } catch (dbErr) {
          console.warn("Failed to fetch quote settings", dbErr);
        }
      }
    }
    if (quote) {
      void loadSettings();
    }
  }, [quote]);

  // Split BOM items into Standard and Optional Accessories
  const { standardItems, optionalAccessories, initialActiveSkus } = useMemo(() => {
    if (!quote || !quote.bom) {
      return { standardItems: [], optionalAccessories: [], initialActiveSkus: new Set<string>() };
    }
    const allSavedItems = (quote.bom.fenceItems || []) as BOMLineItem[];
    let suggestions: ReturnType<typeof suggestAccessories> = [];
    try {
      suggestions = payload ? suggestAccessories(payload, allSavedItems) : [];
    } catch (err) {
      // Incomplete payloads (e.g. line-item-only quotes) must not crash the portal.
      console.warn("[QuotePortalPage] suggestAccessories failed", err);
    }

    // Filter out suggestions and SLIDING-MOTOR from standard items
    const standard = allSavedItems.filter(
      (item) => !suggestions.some((s) => s.sku === item.sku) && item.sku !== "SLIDING-MOTOR"
    );

    // Initial checked state matches what was saved in the quote BOM
    const active = new Set<string>(
      suggestions
        .filter((s) => s.sku && allSavedItems.some((item) => item.sku === s.sku))
        .map((s) => s.sku as string)
    );
    if (allSavedItems.some((item) => item.sku === "SLIDING-MOTOR")) {
      active.add("SLIDING-MOTOR");
    }

    // Ensure we only include accessories that have SKUs
    const optional = suggestions.filter(
      (s): s is typeof s & { sku: string } => !!s.sku
    );

    if (!optional.some((opt) => opt.sku === "SLIDING-MOTOR")) {
      optional.push({
        category: "accessory",
        sku: "SLIDING-MOTOR",
        description: "Optional Sliding Gate Motor",
        quantity: 1,
        unit: "each",
        unitPrice: 1250.0,
        lineTotal: 1250.0,
      } as any);
    }

    return {
      standardItems: standard,
      optionalAccessories: optional,
      initialActiveSkus: active,
    };
  }, [quote, payload]);

  // Set initial checked optional items once data loaded
  useEffect(() => {
    if (initialActiveSkus.size > 0) {
      setActiveOptionalSkus(initialActiveSkus);
    }
  }, [initialActiveSkus]);

  // Toggling optional items
  const handleToggleOptional = (sku: string) => {
    if (isAccepted) return; // Read-only if accepted
    setActiveOptionalSkus((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) {
        next.delete(sku);
      } else {
        next.add(sku);
      }
      return next;
    });
  };

  // Recalculate totals live
  const totals = useMemo(() => {
    const baseTotal = standardItems.reduce((sum, item) => {
      const isCustom =
        item.sku && (item.sku.startsWith("CUSTOM-") || item.notes?.includes("manually"));
      const qty = isCustom ? customQuantities[item.sku!] ?? item.quantity : item.quantity;
      return sum + item.unitPrice * qty;
    }, 0);
    const selectedOptional = optionalAccessories.filter((s) => activeOptionalSkus.has(s.sku));
    const optionalTotal = selectedOptional.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    );

    const subtotal = baseTotal + optionalTotal;
    const gst = subtotal * 0.1;
    const grandTotal = subtotal + gst;

    return {
      subtotal,
      gst,
      grandTotal,
      selectedOptionalCount: selectedOptional.length,
    };
  }, [standardItems, optionalAccessories, activeOptionalSkus, customQuantities]);

  // When staff-authored line items exist, they are the client-facing price — the
  // legacy BOM totals only apply to quotes without line items.
  const displayTotals = hasLineItems ? lineItemTotals : totals;

  const isModified = useMemo(() => {
    if (activeOptionalSkus.size !== initialActiveSkus.size) return true;
    for (const sku of activeOptionalSkus) {
      if (!initialActiveSkus.has(sku)) return true;
    }
    for (const item of standardItems) {
      if (item.sku && (item.sku.startsWith("CUSTOM-") || item.notes?.includes("manually"))) {
        const currentQty = customQuantities[item.sku];
        if (currentQty !== undefined && currentQty !== item.quantity) {
          return true;
        }
      }
    }
    return false;
  }, [activeOptionalSkus, initialActiveSkus, standardItems, customQuantities]);

  // Copy quote link
  const handleCopyLink = () => {
    const url = window.location.href;
    void navigator.clipboard.writeText(url);
    toast.success("Quote link copied to clipboard");
  };

  // Handle Accept & Sign
  const handleAcceptQuote = async (signatureUrlA: string, signatureUrlB: string, signatory: string) => {
    if (!quoteId || !quote) return;
    if (!signatoryEmail.trim()) {
      toast.error("Please enter your email to sign the quote.");
      return;
    }

    setAccepting(true);
    try {
      // 1. Prepare final BOM including only selected accessories.
      // When line items drive this quote, leave the saved BOM untouched —
      // the legacy BOM totals no longer represent the client price.
      const selectedOptional = optionalAccessories.filter((s) => activeOptionalSkus.has(s.sku));
      const finalAccessoriesBOM: BOMLineItem[] = selectedOptional.map((opt) => ({
        category: "accessory",
        sku: opt.sku,
        description: opt.description,
        quantity: opt.quantity,
        unit: opt.sku.includes("4PK") || opt.sku.includes("50PK") ? "pack" : "each",
        unitPrice: opt.unitPrice,
        lineTotal: Math.round(opt.unitPrice * opt.quantity * 100) / 100,
        notes: "added client-side",
      }));

      // Update standard items with client custom quantities
      const updatedStandardItems = standardItems.map((item) => {
        if (item.sku && customQuantities[item.sku] !== undefined) {
          const qty = customQuantities[item.sku];
          return {
            ...item,
            quantity: qty,
            lineTotal: Math.round(item.unitPrice * qty * 100) / 100,
            notes: item.notes ? `${item.notes}; edited by client` : "edited by client",
          };
        }
        return item;
      });

      const finalBOM = hasLineItems
        ? quote.bom
        : {
            ...quote.bom,
            fenceItems: [...updatedStandardItems, ...finalAccessoriesBOM],
            total: totals.subtotal,
            gst: totals.gst,
            grandTotal: totals.grandTotal,
            generatedAt: new Date().toISOString(),
          };

      try {
        const { error: quoteUpdateError } = await supabase
          .from("quotes")
          .update({
            status: "accepted",
            bom: finalBOM,
            updated_at: new Date().toISOString(),
          })
          .eq("id", quoteId);

        if (quoteUpdateError) throw quoteUpdateError;
      } catch (dbErr) {
        console.warn("Failed to update quote status in Supabase, falling back to local storage update", dbErr);
      }

      // 3. Insert quote acceptance signature record
      try {
        const { error: signatureError } = await supabase
          .from("quote_acceptances")
          .insert({
            quote_id: quoteId,
            accepted_by: signatory,
            email: signatoryEmail.trim(),
            signature_data: signatureUrlA,
            signature_data_b: signatureUrlB,
            user_agent: navigator.userAgent,
            org_id: quote.org_id,
          });

        if (signatureError) throw signatureError;
      } catch (dbErr) {
        console.warn("Failed to save acceptance to Supabase, falling back to local storage acceptance", dbErr);
      }

      // Also update localStorage quote status if it exists
      try {
        const stored = localStorage.getItem("qsbom-quotes");
        if (stored) {
          const list = JSON.parse(stored);
          if (Array.isArray(list)) {
            const index = list.findIndex((q: any) => q.id === quoteId);
            if (index > -1) {
              list[index].status = "accepted";
              list[index].bom = finalBOM;
              list[index].signature_data = signatureUrlA;
              list[index].signature_data_b = signatureUrlB;
              localStorage.setItem("qsbom-quotes", JSON.stringify(list));
            }
          }
        }
      } catch (e) {
        console.error("Failed to update localStorage", e);
      }

      setLocalAccepted(true);
      toast.success("Quote accepted successfully!");
      setAcceptanceDetails({
        accepted_by: signatory,
        email: signatoryEmail.trim(),
        signature_data: signatureUrlA,
        signature_data_b: signatureUrlB,
        ip_address: "Local Client",
        created_at: new Date().toISOString()
      });
      try {
        await quoteQuery.refetch();
      } catch (refetchErr) {
        console.warn("Failed to refetch quote", refetchErr);
      }
    } catch (error) {
      console.error(error);
      // fallback for local/offline testing
      try {
        const stored = localStorage.getItem("qsbom-quotes");
        if (stored) {
          const list = JSON.parse(stored);
          if (Array.isArray(list)) {
            const index = list.findIndex((q: any) => q.id === quoteId);
            if (index > -1) {
              list[index].status = "accepted";
              list[index].signature_data = signatureUrlA;
              list[index].signature_data_b = signatureUrlB;
              localStorage.setItem("qsbom-quotes", JSON.stringify(list));
            }
          }
        }
      } catch (e) {
        console.error("Failed to update localStorage fallback", e);
      }
      toast.success("Quote accepted (Local mode)");
      setAcceptanceDetails({
        accepted_by: signatory,
        email: signatoryEmail.trim(),
        signature_data: signatureUrlA,
        signature_data_b: signatureUrlB,
        ip_address: "Local Client",
        created_at: new Date().toISOString()
      });
      setLocalAccepted(true);
    } finally {
      setAccepting(false);
    }
  };

  const onAcceptQuoteBtnClick = async () => {
    const signatureUrlA = canvasRefA.current?.toDataURL("image/png") || "mock-signature-url-a";
    const signatureUrlB = canvasRefB.current?.toDataURL("image/png") || "mock-signature-url-b";
    await handleAcceptQuote(signatureUrlA, signatureUrlB, quote?.contact?.fullName || "Client Dual Signature");
  };

  if (quoteQuery.isLoading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-brand-text/60 font-semibold">Loading interactive proposal...</p>
        </div>
      </div>
    );
  }

  if (quoteQuery.isError || !quote) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6 bg-brand-card border border-brand-border rounded-3xl p-8 shadow-2xl">
          <AlertTriangle className="mx-auto text-amber-500" size={48} />
          <h2 className="text-2xl font-black text-brand-text">Quote Not Found</h2>
          <p className="text-brand-muted text-sm leading-relaxed">
            The quote link you followed may have expired, or is incorrect. Please check with your installer or
            supplier.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center space-x-2 text-sm font-semibold text-brand-primary hover:underline"
          >
            <span>Back to Login</span>
          </Link>
        </div>
      </div>
    );
  }

  const formattedExpiry = new Date(
    new Date(quote.created_at).getTime() + 14 * 24 * 60 * 60 * 1000
  ).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });

  // Render maps static snapshot if available
  const mapSnapshotUrl = payload?.snapshot
    ? payload.snapshot.layers?.satellite?.url || payload.snapshot.url
    : null;

  return (
    <div className="h-screen overflow-y-auto bg-brand-bg text-brand-text pb-12 font-sans selection:bg-brand-primary/30">
      {/* Client Co-Branding Top Bar */}
      <header className="sticky top-0 z-40 bg-brand-card/85 backdrop-blur-md border-b border-brand-border/40 px-6 py-4 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <BrandLogo src={portalLogoUrl} className="h-12 w-auto sm:h-14" />
            <span data-testid="client-quote-header" className="text-xl font-black tracking-tight text-brand-text">
              {DEFAULT_BRAND.companyName}
            </span>
            <span className="text-xs text-brand-muted/60 bg-brand-border/40 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
              Interactive Quote
            </span>
          </div>

          <div className="flex items-center space-x-3">
            {currentUser && (
              <Link
                to={`/quote/${quote.id}`}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-brand-border/50 text-xs font-semibold text-brand-muted hover:text-brand-text hover:bg-brand-border/20 transition-all"
              >
                <ArrowLeft size={12} />
                <span>Return to Editor</span>
              </Link>
            )}
            <button
              onClick={handleCopyLink}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-brand-border/40 hover:bg-brand-border/60 text-xs font-semibold text-brand-text transition-all"
            >
              <Copy size={12} />
              <span>Copy Link</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 mt-6 sm:px-6">
        {/* Quote Accepted Success Alert Banner */}
        {isAccepted && (
          <div
            data-testid="quote-accepted-success-alert"
            className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl text-center font-bold"
          >
            Quote has been successfully accepted!
          </div>
        )}

        {/* Dynamic Status Hero Banner */}
        <div className="mb-8 relative overflow-hidden rounded-3xl border border-brand-border/40 bg-brand-card p-6 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="absolute top-0 right-0 w-96 h-96 bg-brand-primary/5 rounded-full filter blur-3xl pointer-events-none" />
          <div className="flex items-center space-x-4">
            {isAccepted ? (
              <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-2xl border border-emerald-500/25">
                <CheckCircle size={32} />
              </div>
            ) : (
              <div className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl border border-amber-500/25 animate-pulse">
                <Clock size={32} />
              </div>
            )}
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-black text-white">
                  Proposal: {quote.contact?.fullName || quote.customer_ref || quote.title || ""}
                </h1>
                <span className="text-xs text-brand-muted">#{quote.quote_number || "Draft"}</span>
              </div>
              <p className="text-sm text-brand-muted mt-1 leading-relaxed">
                {isAccepted
                  ? `Accepted on ${new Date(
                      acceptanceDetails?.created_at || quote.updated_at
                    ).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}`
                  : `Please review options and accept online before ${formattedExpiry}`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex items-center space-x-1 text-xs text-brand-muted bg-brand-border/20 px-3 py-1.5 rounded-xl border border-brand-border/20 font-semibold">
              <Calendar size={14} className="text-brand-primary" />
              <span>Expires: {formattedExpiry}</span>
            </div>
            {isAccepted && (
              <span className="text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/35 px-3 py-1.5 rounded-xl">
                Accepted
              </span>
            )}
          </div>
        </div>

        {/* Two-Column Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT: Project Spec & Layout Details */}
          <div className="lg:col-span-7 space-y-6">
            {/* Site address card */}
            {quote.property_anchor?.address && (
              <div className="bg-brand-card/40 border border-brand-border/30 rounded-3xl p-6 relative">
                <h3 className="text-xs font-black uppercase tracking-wider text-brand-muted mb-4 flex items-center space-x-2">
                  <MapPin size={14} className="text-brand-primary" />
                  <span>Installation Site Address</span>
                </h3>
                <p className="text-base font-bold text-white leading-relaxed">
                  {quote.property_anchor.address}
                </p>

                {/* Satellite map preview */}
                {mapSnapshotUrl && (
                  <div className="mt-4 rounded-2xl overflow-hidden border border-brand-border/40 aspect-[16/9] relative shadow-lg">
                    <img src={mapSnapshotUrl} alt="Site map snapshot" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent flex items-end p-4">
                      <span className="text-xs font-semibold text-white/90">
                        Planned layout overlay (approximate scale)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Fence Spec Summary */}
            <div className="bg-brand-card/40 border border-brand-border/30 rounded-3xl p-6">
              <h3 className="text-xs font-black uppercase tracking-wider text-brand-muted mb-4 flex items-center space-x-2">
                <FileText size={14} className="text-brand-primary" />
                <span>Fence Configurations Summary</span>
              </h3>

              {payload?.runs && payload.runs.length > 0 ? (
                <div className="space-y-4">
                  {payload.runs.map((run, idx) => {
                    const fenceSegments = run.segments.filter((s) => s.segmentKind !== "gate_opening");
                    const gateSegments = run.segments.filter((s) => s.segmentKind === "gate_opening");
                    const totalLength = (
                      run.segments.reduce((sum, s) => sum + (s.segmentWidthMm || 0), 0) / 1000
                    ).toFixed(1);

                    return (
                      <div
                        key={run.runId}
                        className="p-4 rounded-2xl border border-brand-border/30 bg-brand-bg/40 flex flex-col sm:flex-row justify-between gap-4"
                      >
                        <div>
                          <h4 className="font-bold text-base text-white">
                            Run {idx + 1}: {run.productCode === "QSHS" ? "Horizontal Slats" : "Vertical Slats"}
                          </h4>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <span className="text-xs font-semibold bg-brand-border/40 text-brand-muted px-2 py-0.5 rounded-md">
                              Colour: {run.variables?.colour_code || "Mill"}
                            </span>
                            <span className="text-xs font-semibold bg-brand-border/40 text-brand-muted px-2 py-0.5 rounded-md">
                              {run.variables?.slat_size_mm || 65}mm slat / {run.variables?.slat_gap_mm || 9}mm gap
                            </span>
                          </div>
                        </div>
                        <div className="sm:text-right flex flex-col justify-center">
                          <span className="text-lg font-black text-brand-primary">{totalLength}m Total Length</span>
                          <span className="text-xs text-brand-muted">
                            {fenceSegments.length} Section{fenceSegments.length === 1 ? "" : "s"}
                            {gateSegments.length > 0 && ` + ${gateSegments.length} Gate${gateSegments.length === 1 ? "" : "s"}`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-brand-muted italic">No runs specified</p>
              )}
            </div>

            {/* Live comments thread */}
            <QuoteComments quoteId={quote.id} currentUser={currentUser} clientName={quote.contact?.fullName} orgId={quote.org_id} />
          </div>

          {/* RIGHT: Price Table & Interactive Accepting Panel */}
          <div className="lg:col-span-5 space-y-6">
            {/* Interactive Pricing Summary Card */}
            <div className="bg-brand-card border border-brand-border/50 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-primary via-sky-400 to-indigo-500" />
              <h2 className="text-lg font-black text-white mb-6 uppercase tracking-wider">Quote BOM & Pricing</h2>

              {/* Staff-authored line items (from quote_line_items_public) */}
              {hasLineItems && (
                <>
                  <div className="space-y-4 max-h-[280px] overflow-y-auto pr-1 scrollbar-thin">
                    <div className="text-xs font-bold text-brand-muted uppercase tracking-wider border-b border-brand-border/30 pb-2 flex justify-between">
                      <span>Quote Items</span>
                      <span>Total</span>
                    </div>
                    {publicLineItems
                      .filter((item) => !item.is_optional)
                      .map((item) => {
                        if (item.kind === "heading") {
                          return (
                            <h3
                              key={item.id}
                              data-testid="portal-line-heading"
                              className="pt-3 text-sm font-black uppercase tracking-wide text-brand-text"
                            >
                              {item.title}
                            </h3>
                          );
                        }
                        if (item.kind === "text") {
                          return (
                            <p
                              key={item.id}
                              data-testid="portal-line-text"
                              className="whitespace-pre-line text-xs leading-relaxed text-brand-muted"
                            >
                              {item.description}
                            </p>
                          );
                        }
                        return (
                        <div
                          key={item.id}
                          data-testid="portal-line-item"
                          className="flex justify-between items-start text-xs border-b border-brand-border/10 pb-2"
                        >
                          <div className="flex max-w-[75%] items-start gap-2.5">
                            {item.image_url && (
                              <img
                                src={item.image_url}
                                alt=""
                                loading="lazy"
                                data-testid="portal-line-item-image"
                                className="mt-0.5 h-14 w-14 shrink-0 rounded-lg border border-brand-border/40 object-cover"
                              />
                            )}
                            <div className="min-w-0">
                            <p className="font-bold text-white/95">{item.title}</p>
                            {item.description?.trim() ? (
                              <p className="text-brand-muted text-[10px] mt-0.5 whitespace-pre-line">
                                {item.description}
                              </p>
                            ) : null}
                            <p className="text-brand-muted text-[10px] mt-0.5">
                              Qty: {item.quantity} {item.unit} @ $
                              {item.unit_price.toFixed(2)}
                            </p>
                            </div>
                          </div>
                          <span className="font-semibold text-white/90">
                            ${(item.quantity * item.unit_price).toFixed(2)}
                          </span>
                        </div>
                        );
                      })}
                  </div>

                  {publicLineItems.some((item) => item.is_optional) && (
                    <div className="mt-6">
                      <h3 className="text-xs font-black text-brand-muted uppercase tracking-wider border-b border-brand-border/30 pb-2 mb-3">
                        Optional Items (Select to add to quote)
                      </h3>
                      <div className="space-y-3">
                        {publicLineItems
                          .filter((item) => item.is_optional)
                          .map((item) => {
                            const checked = activeOptionalLineIds.has(item.id);
                            return (
                              <label
                                key={item.id}
                                className={`flex items-start justify-between p-3 rounded-2xl border transition-all cursor-pointer select-none ${
                                  checked
                                    ? "border-brand-primary bg-brand-primary/5 text-white"
                                    : "border-brand-border/40 bg-brand-bg/25 text-brand-text/60 hover:bg-brand-bg/40"
                                } ${isAccepted ? "pointer-events-none opacity-80" : ""}`}
                              >
                                <div className="flex items-start space-x-3 max-w-[70%]">
                                  <input
                                    type="checkbox"
                                    data-testid={`optional-line-item-checkbox-${item.id}`}
                                    checked={checked}
                                    disabled={isAccepted}
                                    onChange={() => handleToggleOptionalLine(item.id)}
                                    className="mt-0.5 rounded border-brand-border/60 text-brand-primary focus:ring-brand-primary focus:ring-offset-brand-card w-4 h-4"
                                  />
                                  <div>
                                    <p className="text-xs font-bold leading-tight">
                                      {item.title}
                                    </p>
                                    {item.description?.trim() ? (
                                      <p className="text-[10px] text-brand-muted/70 mt-0.5 whitespace-pre-line">
                                        {item.description}
                                      </p>
                                    ) : null}
                                    <p className="text-[10px] text-brand-muted/70 mt-0.5">
                                      Qty: {item.quantity} {item.unit}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs font-semibold">
                                    +${(item.quantity * item.unit_price).toFixed(2)}
                                  </span>
                                </div>
                              </label>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* standard items table (non-accessories) — legacy BOM quotes only */}
              {!hasLineItems && (
              <div className="space-y-4 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
                <div className="text-xs font-bold text-brand-muted uppercase tracking-wider border-b border-brand-border/30 pb-2 flex justify-between">
                  <span>Standard Materials & Labor</span>
                  <span>Total</span>
                </div>
                {standardItems.map((item, idx) => {
                  const isCustom =
                    item.sku && (item.sku.startsWith("CUSTOM-") || item.notes?.includes("manually"));
                  const qtyVal = isCustom ? customQuantities[item.sku!] ?? item.quantity : item.quantity;
                  return (
                    <div
                      key={idx}
                      className="flex justify-between items-start text-xs border-b border-brand-border/10 pb-2"
                    >
                      <div className="max-w-[75%]">
                        <p className="font-bold text-white/95">{item.description}</p>
                        {isCustom ? (
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="text-brand-muted text-[10px]">Qty:</span>
                            <input
                              type="number"
                              data-testid={`client-qty-input-${item.sku}`}
                              value={qtyVal}
                              disabled={isAccepted}
                              onChange={(e) => {
                                const val = Math.max(0, parseInt(e.target.value) || 0);
                                setCustomQuantities((prev) => ({ ...prev, [item.sku!]: val }));
                              }}
                              className="w-16 px-1.5 py-0.5 rounded border border-brand-border/40 bg-brand-bg/50 text-white text-[10px] focus:outline-none focus:border-brand-primary"
                            />
                            <span className="text-brand-muted text-[10px]">{item.unit}</span>
                          </div>
                        ) : (
                          <p className="text-brand-muted text-[10px]">
                            Qty: {item.quantity} {item.unit}
                          </p>
                        )}
                      </div>
                      <span className="font-semibold text-white/90">
                        ${(item.unitPrice * qtyVal).toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
              )}

              {/* Suggested / Optional accessories checklist — legacy BOM quotes only */}
              {!hasLineItems && optionalAccessories.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-xs font-black text-brand-muted uppercase tracking-wider border-b border-brand-border/30 pb-2 mb-3">
                    Optional Accessories (Select to add to quote)
                  </h3>
                  <div className="space-y-3">
                    {optionalAccessories.map((opt) => {
                      const checked = activeOptionalSkus.has(opt.sku);
                      const isReadOnly = isAccepted;

                      return (
                        <label
                          key={opt.sku}
                          className={`flex items-start justify-between p-3 rounded-2xl border transition-all cursor-pointer select-none ${
                            checked
                              ? "border-brand-primary bg-brand-primary/5 text-white"
                              : "border-brand-border/40 bg-brand-bg/25 text-brand-text/60 hover:bg-brand-bg/40"
                          } ${isReadOnly ? "pointer-events-none opacity-80" : ""}`}
                        >
                          <div className="flex items-start space-x-3 max-w-[70%]">
                            <input
                              type="checkbox"
                              data-testid={`optional-item-checkbox-${opt.sku}`}
                              checked={checked}
                              disabled={isReadOnly}
                              onChange={() => handleToggleOptional(opt.sku)}
                              className="mt-0.5 rounded border-brand-border/60 text-brand-primary focus:ring-brand-primary focus:ring-offset-brand-card w-4 h-4"
                            />
                            <div>
                              <p className="text-xs font-bold leading-tight">{opt.description}</p>
                              <p className="text-[10px] text-brand-muted/70 mt-0.5">
                                Qty: {opt.quantity}{" "}
                                {opt.sku.includes("4PK") || opt.sku.includes("50PK") ? "pack" : "each"}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-semibold">
                              +${(opt.unitPrice * opt.quantity).toFixed(2)}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Totals panel */}
              <div className="mt-8 border-t border-brand-border/40 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-brand-muted font-semibold">Subtotal</span>
                  <span className="font-semibold text-white/90">${displayTotals.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-brand-muted font-semibold">GST (10%)</span>
                  <span className="font-semibold text-white/90">${displayTotals.gst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-baseline pt-2 border-t border-brand-border/30">
                  <span className="text-base font-black text-white uppercase tracking-wider">Total (inc. GST)</span>
                  <span data-testid="client-quote-total" className="text-2xl font-black text-brand-primary">
                    {!hasLineItems && isModified ? "Updated Total: " : ""}${displayTotals.grandTotal.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Deposit Calculations & Pay Deposit Trigger (Rendered after quote is accepted) */}
            {isAccepted && (
              <div className="bg-brand-card border border-brand-border/40 rounded-3xl p-6 shadow-2xl space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-xs font-semibold text-brand-muted uppercase tracking-wider">
                      Deposit Amount ({depositPercent}%)
                    </h4>
                    <p data-testid="deposit-amount" className="text-lg font-black text-white mt-1">
                      {depositPercent}% - ${((displayTotals.grandTotal * depositPercent) / 100).toFixed(2)}
                    </p>
                  </div>
                  <button
                    type="button"
                    data-testid="pay-deposit-btn"
                    onClick={() => setShowPaymentModal(true)}
                    className="px-4 py-2.5 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold rounded-xl text-xs transition-all shadow-md"
                  >
                    Pay Deposit
                  </button>
                </div>
              </div>
            )}

            {/* Accepting e-signature drawer/box */}
            {!isAccepted ? (
              <div className="bg-brand-card border border-brand-border/40 rounded-3xl p-6 shadow-2xl space-y-4 relative">
                {accepting && (
                  <div className="absolute inset-0 bg-brand-bg/65 backdrop-blur-sm flex items-center justify-center rounded-3xl z-10">
                    <div className="flex flex-col items-center space-y-2">
                      <Loader2 className="animate-spin text-brand-primary" size={28} />
                      <p className="text-xs font-bold text-white">Saving signature...</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center space-x-2 border-b border-brand-border/30 pb-3">
                  <Lock size={16} className="text-brand-primary" />
                  <h3 className="font-bold text-sm uppercase tracking-wider text-brand-text">
                    Sign & Accept Proposal
                  </h3>
                </div>

                <p className="text-xs text-brand-muted leading-relaxed">
                  Enter your email and provide both signatures below to approve the proposal. An accepted agreement
                  commits the final materials configuration listed above.
                </p>

                <div className="flex flex-col space-y-2">
                  <label className="text-xs font-semibold text-brand-muted uppercase tracking-wider">
                    Your Email Address
                  </label>
                  <input
                    type="email"
                    value={signatoryEmail}
                    onChange={(e) => setSignatoryEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full px-4 py-3 rounded-xl border border-brand-border/40 bg-brand-bg/50 text-brand-text placeholder-brand-text/30 focus:outline-none focus:border-brand-primary transition-all font-semibold"
                    required
                  />
                </div>

                {/* Dual Signature Pads */}
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-brand-muted uppercase tracking-wider block mb-1">
                      Client A Signature
                    </label>
                    <div className="relative border border-brand-border/40 rounded-xl bg-black h-32">
                      <canvas
                        ref={canvasRefA}
                        data-testid="client-a-signature-pad"
                        className="w-full h-full cursor-crosshair"
                        onMouseDown={handleStartA}
                        onMouseMove={handleDrawA}
                        onMouseUp={handleStopA}
                        onMouseLeave={handleStopA}
                        onTouchStart={handleStartA}
                        onTouchMove={handleDrawA}
                        onTouchEnd={handleStopA}
                      />
                      <button
                        type="button"
                        onClick={clearA}
                        className="absolute bottom-1 right-1 px-2 py-0.5 bg-brand-bg/85 text-[10px] text-brand-muted hover:text-white rounded border border-brand-border/40"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-brand-muted uppercase tracking-wider block mb-1">
                      Client B Signature
                    </label>
                    <div className="relative border border-brand-border/40 rounded-xl bg-black h-32">
                      <canvas
                        ref={canvasRefB}
                        data-testid="client-b-signature-pad"
                        className="w-full h-full cursor-crosshair"
                        onMouseDown={handleStartB}
                        onMouseMove={handleDrawB}
                        onMouseUp={handleStopB}
                        onMouseLeave={handleStopB}
                        onTouchStart={handleStartB}
                        onTouchMove={handleDrawB}
                        onTouchEnd={handleStopB}
                      />
                      <button
                        type="button"
                        onClick={clearB}
                        className="absolute bottom-1 right-1 px-2 py-0.5 bg-brand-bg/85 text-[10px] text-brand-muted hover:text-white rounded border border-brand-border/40"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  data-testid="accept-quote-btn"
                  disabled={!signedA || !signedB || accepting}
                  onClick={onAcceptQuoteBtnClick}
                  className="w-full py-3 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold rounded-xl text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {accepting ? "Accepting..." : "Accept & Sign Proposal"}
                </button>
              </div>
            ) : (
              <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-3xl p-6 shadow-2xl text-center space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full filter blur-xl pointer-events-none" />
                <CheckCircle className="mx-auto text-emerald-500" size={40} />
                <h3 className="font-black text-base text-emerald-400 uppercase tracking-wider">Proposal Accepted</h3>
                {loadingAcceptance ? (
                  <Loader2 className="animate-spin mx-auto text-brand-muted" size={16} />
                ) : (
                  acceptanceDetails && (
                    <div className="text-xs text-brand-muted space-y-2 max-w-sm mx-auto">
                      <p>
                        Approved by <span className="font-bold text-white">{acceptanceDetails.accepted_by}</span> (
                        <span className="italic">{acceptanceDetails.email}</span>)
                      </p>
                      <p>IP: {acceptanceDetails.ip_address || "Client Verification Device"}</p>
                      <div className="pt-2 border-t border-brand-border/20 mt-2">
                        <span className="text-[10px] uppercase text-brand-muted/60 tracking-wider">
                          Signature Captured
                        </span>
                        {acceptanceDetails.signature_data && (
                          <div className="mt-1 bg-white p-2 rounded-xl border border-brand-border max-w-[200px] mx-auto mb-2">
                            <img
                              src={acceptanceDetails.signature_data}
                              alt="Captured client signature A"
                              className="h-12 w-auto object-contain mx-auto"
                              style={{ filter: "brightness(0)" }}
                            />
                          </div>
                        )}
                        {acceptanceDetails.signature_data_b && (
                          <div className="mt-1 bg-white p-2 rounded-xl border border-brand-border max-w-[200px] mx-auto">
                            <img
                              src={acceptanceDetails.signature_data_b}
                              alt="Captured client signature B"
                              className="h-12 w-auto object-contain mx-auto"
                              style={{ filter: "brightness(0)" }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Simulated Payment Modal */}
      {showPaymentModal && (
        <div
          data-testid="payment-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="bg-brand-card border border-brand-border rounded-3xl p-6 max-w-md w-full shadow-2xl relative">
            <h3 className="text-lg font-black text-white mb-4">Deposit Payment</h3>
            <p className="text-sm text-brand-muted mb-6">
              Simulated payment gateway for {depositPercent}% deposit: $
              {((displayTotals.grandTotal * depositPercent) / 100).toFixed(2)}.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 border border-brand-border rounded-xl text-sm font-bold hover:bg-brand-bg text-white"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  toast.success("Deposit payment successful!");
                  setShowPaymentModal(false);
                }}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-sm"
              >
                Simulate Success
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

