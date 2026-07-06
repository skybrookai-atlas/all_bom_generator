import { useCallback, useRef, useState } from "react";
import { FileSpreadsheet, Loader2, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "../../components/admin/AdminLayout";
import { supabase } from "../../lib/supabase";

interface PendingFile {
  name: string;
  csvText: string;
  supplierName: string;
}

interface ImportResult {
  file: string;
  supplier?: string;
  added?: number;
  updated?: number;
  skippedOlder?: number;
  skippedLines?: number;
  error?: string;
}

const nameFromFile = (fileName: string) =>
  fileName.replace(/\.csv$/i, "").replace(/\s*\(\d+\)$/, "").trim();

export function CatalogueImportPage() {
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const list = [...files].filter((f) => /\.csv$/i.test(f.name));
    if (!list.length) {
      toast.error("Only .csv files are supported (Xero bill exports)");
      return;
    }
    const read = await Promise.all(
      list.map(
        (f) =>
          new Promise<PendingFile>((res, rej) => {
            const reader = new FileReader();
            reader.onload = () =>
              res({
                name: f.name,
                csvText: String(reader.result ?? ""),
                supplierName: nameFromFile(f.name),
              });
            reader.onerror = () => rej(reader.error);
            reader.readAsText(f);
          }),
      ),
    );
    setPending((prev) => {
      const names = new Set(prev.map((p) => p.name));
      return [...prev, ...read.filter((r) => !names.has(r.name))];
    });
    setResults(null);
  }, []);

  const runImport = async () => {
    if (!pending.length || importing) return;
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "import-supplier-bills",
        { body: { files: pending } },
      );
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setResults(data.results as ImportResult[]);
      const t = data.totals ?? {};
      toast.success(
        `Imported: ${t.added ?? 0} new prices, ${t.updated ?? 0} updated`,
      );
      setPending([]);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Import failed — try again",
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <AdminLayout
      title="Catalogue import"
      subtitle="Drop Xero bill exports (CSV) to add or refresh supplier prices — newest invoice price always wins."
    >
      <div className="max-w-3xl space-y-5">
        {/* Drop zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void addFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 cursor-pointer transition-colors ${
            dragOver
              ? "border-brand-accent bg-brand-accent/10"
              : "border-brand-border hover:border-brand-accent/60 hover:bg-brand-card/60"
          }`}
        >
          <UploadCloud size={28} className="text-brand-accent" />
          <p className="text-sm font-medium text-brand-text">
            Drop Xero invoice CSVs here, or click to browse
          </p>
          <p className="text-xs text-brand-muted text-center max-w-md">
            Export bills from Xero as CSV (one file per supplier works best).
            Delivery, freight and note lines are skipped automatically. If an
            item was bought more than once, the most recent invoice sets the
            price.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {/* Pending files */}
        {pending.length > 0 && (
          <div className="rounded-xl border border-brand-border bg-brand-card divide-y divide-brand-border/60">
            {pending.map((f, idx) => (
              <div key={f.name} className="flex items-center gap-3 px-4 py-2.5">
                <FileSpreadsheet size={16} className="text-brand-accent shrink-0" />
                <span className="text-sm text-brand-text truncate flex-1">
                  {f.name}
                </span>
                <label className="flex items-center gap-1.5 text-xs text-brand-muted">
                  Supplier
                  <input
                    value={f.supplierName}
                    onChange={(e) =>
                      setPending((prev) =>
                        prev.map((p, i) =>
                          i === idx
                            ? { ...p, supplierName: e.target.value }
                            : p,
                        ),
                      )
                    }
                    className="w-44 px-2 py-1 rounded-md border border-brand-border bg-brand-bg text-brand-text text-xs"
                  />
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setPending((prev) => prev.filter((_, i) => i !== idx))
                  }
                  title="Remove file"
                  className="p-1 text-brand-muted hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <div className="px-4 py-3 flex justify-end">
              <button
                type="button"
                onClick={() => void runImport()}
                disabled={importing}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-brand-accent text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {importing && <Loader2 size={14} className="animate-spin" />}
                {importing
                  ? "Importing…"
                  : `Import ${pending.length} file${pending.length > 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="rounded-xl border border-brand-border bg-brand-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-brand-muted border-b border-brand-border/60">
                  <th className="px-4 py-2 font-medium">File</th>
                  <th className="px-4 py-2 font-medium">Supplier</th>
                  <th className="px-4 py-2 font-medium text-right">New</th>
                  <th className="px-4 py-2 font-medium text-right">Updated</th>
                  <th className="px-4 py-2 font-medium text-right">
                    Kept newer price
                  </th>
                  <th className="px-4 py-2 font-medium text-right">
                    Skipped lines
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/40">
                {results.map((r) => (
                  <tr key={r.file} className="text-brand-text">
                    <td className="px-4 py-2 truncate max-w-[180px]">{r.file}</td>
                    {r.error ? (
                      <td colSpan={5} className="px-4 py-2 text-red-500 text-xs">
                        {r.error}
                      </td>
                    ) : (
                      <>
                        <td className="px-4 py-2">{r.supplier}</td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {r.added}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {r.updated}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-brand-muted">
                          {r.skippedOlder}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-brand-muted">
                          {r.skippedLines}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
