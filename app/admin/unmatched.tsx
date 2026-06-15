"use client";

import { ArrowLeft, CheckCircle2, RefreshCw, ShieldAlert, Tag, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Product, Report, Store, UnmatchedReport } from "../lib/types";

type AdminSnapshot = {
  products: Product[];
  unmatchedReports: Array<
    UnmatchedReport & {
      report: Report | null;
      store: Store | null;
      matchedProduct: Product | null;
    }
  >;
};

export default function AdminUnmatched() {
  const [snapshot, setSnapshot] = useState<AdminSnapshot | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    loadSnapshot();
  }, []);

  async function loadSnapshot() {
    const response = await fetch("/api/admin/unmatched", { cache: "no-store" });
    setSnapshot((await response.json()) as AdminSnapshot);
  }

  async function updateUnmatched(
    unmatchedReportId: string,
    payload: { productId?: string; alias?: string; saveAlias?: boolean; adminStatus: "matched" | "ignored" }
  ) {
    setBusyId(unmatchedReportId);
    await fetch("/api/admin/unmatched", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unmatchedReportId, ...payload })
    });
    setBusyId(null);
    await loadSnapshot();
  }

  if (!snapshot) {
    return (
      <main className="loading-screen">
        <RefreshCw className="spin" size={24} />
        Loading admin queue
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Unmatched Reports</h1>
        </div>
        <Link className="icon-link" href="/">
          <ArrowLeft size={18} />
          Map
        </Link>
      </header>

      <section className="admin-list">
        {snapshot.unmatchedReports.length ? (
          snapshot.unmatchedReports.map((unmatched) => (
            <UnmatchedCard
              key={unmatched.id}
              unmatched={unmatched}
              products={snapshot.products}
              busy={busyId === unmatched.id}
              onUpdate={(payload) => updateUnmatched(unmatched.id, payload)}
            />
          ))
        ) : (
          <div className="empty-state wide">
            <ShieldAlert size={24} />
            <span>No unmatched reports yet.</span>
          </div>
        )}
      </section>
    </main>
  );
}

function UnmatchedCard({
  unmatched,
  products,
  busy,
  onUpdate
}: {
  unmatched: AdminSnapshot["unmatchedReports"][number];
  products: Product[];
  busy: boolean;
  onUpdate: (payload: {
    productId?: string;
    alias?: string;
    saveAlias?: boolean;
    adminStatus: "matched" | "ignored";
  }) => void;
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [alias, setAlias] = useState(unmatched.rawProductText);
  const [saveAlias, setSaveAlias] = useState(false);

  return (
    <article className={`admin-card ${unmatched.adminStatus}`}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{unmatched.adminStatus}</p>
          <h2>{unmatched.rawProductText}</h2>
          <p className="muted">
            {unmatched.store?.name ?? "Unknown store"} · {new Date(unmatched.createdAt).toLocaleString()}
          </p>
        </div>
        {unmatched.adminStatus === "matched" ? <CheckCircle2 className="success" /> : null}
      </div>

      {unmatched.adminStatus === "pending" ? (
        <div className="admin-form">
          <label>
            Attach product
            <select value={productId} onChange={(event) => setProductId(event.target.value)}>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.canonicalName}
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox-row">
            <input
              checked={saveAlias}
              onChange={(event) => setSaveAlias(event.target.checked)}
              type="checkbox"
            />
            Save raw text as alias for future matching
          </label>
          <label>
            Alias to save
            <input value={alias} onChange={(event) => setAlias(event.target.value)} />
          </label>
          <div className="update-actions">
            <button
              disabled={busy}
              onClick={() => onUpdate({ adminStatus: "matched", productId, alias, saveAlias })}
            >
              <Tag size={16} />
              Match
            </button>
            <button disabled={busy} onClick={() => onUpdate({ adminStatus: "ignored" })}>
              <XCircle size={16} />
              Ignore
            </button>
          </div>
        </div>
      ) : (
        <p className="muted">
          {unmatched.matchedProduct
            ? `Matched to ${unmatched.matchedProduct.canonicalName}`
            : "Ignored for now"}
        </p>
      )}
    </article>
  );
}
