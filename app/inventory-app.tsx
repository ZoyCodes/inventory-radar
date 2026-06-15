"use client";

import {
  Activity,
  Boxes,
  CheckCircle2,
  CircleHelp,
  Clock3,
  PackagePlus,
  RefreshCw,
  Search,
  ShieldAlert,
  Store as StoreIcon,
  XCircle
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Snapshot } from "./lib/data";
import type { EnrichedReport, ReportStatus, ReportUpdateStatus, Store } from "./lib/types";

type ReportForm = {
  storeId: string;
  rawProductText: string;
  quantityObserved: string;
  rawPrice: string;
  status: ReportStatus;
  photoUrl: string;
};

const emptyForm: ReportForm = {
  storeId: "",
  rawProductText: "",
  quantityObserved: "",
  rawPrice: "",
  status: "in_stock",
  photoUrl: ""
};

export default function InventoryApp() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [form, setForm] = useState<ReportForm>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadSnapshot();
  }, []);

  const selectedStore = useMemo(
    () => snapshot?.stores.find((store) => store.id === selectedStoreId) ?? null,
    [selectedStoreId, snapshot?.stores]
  );

  const reportsByStore = useMemo(() => {
    const map = new Map<string, EnrichedReport[]>();
    snapshot?.reports.forEach((report) => {
      const reports = map.get(report.storeId) ?? [];
      reports.push(report);
      map.set(report.storeId, reports);
    });
    return map;
  }, [snapshot?.reports]);

  const filteredStores = useMemo(() => {
    if (!snapshot) return [];
    const needle = query.toLowerCase().trim();
    if (!needle) return snapshot.stores;
    return snapshot.stores.filter((store) =>
      `${store.name} ${store.address} ${store.retailerType}`.toLowerCase().includes(needle)
    );
  }, [query, snapshot]);

  async function loadSnapshot() {
    const response = await fetch("/api/stores", { cache: "no-store" });
    const data = (await response.json()) as Snapshot;
    setSnapshot(data);
    setSelectedStoreId((current) => current || data.stores[0]?.id || "");
    setForm((current) => ({
      ...current,
      storeId: current.storeId || data.stores[0]?.id || ""
    }));
  }

  function openReport(storeId = selectedStoreId) {
    setForm({ ...emptyForm, storeId });
    setIsReportOpen(true);
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        createdBy: getContributorId(),
        quantityObserved: form.quantityObserved ? Number(form.quantityObserved) : null
      })
    });

    setIsSubmitting(false);
    setIsReportOpen(false);
    setForm(emptyForm);
    await loadSnapshot();
  }

  async function sendReportUpdate(reportId: string, status: ReportUpdateStatus) {
    await fetch("/api/report-updates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId, status, createdBy: getContributorId() })
    });
    await loadSnapshot();
  }

  if (!snapshot) {
    return (
      <main className="loading-screen">
        <RefreshCw className="spin" size={24} />
        Loading local sightings
      </main>
    );
  }

  const selectedReports = selectedStore ? reportsByStore.get(selectedStore.id) ?? [] : [];

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Capital Region, NY</p>
          <h1>Inventory Radar</h1>
        </div>
        <div className="topbar-actions">
          <a className="icon-link" href="/admin/login" title="Review unmatched reports">
            <ShieldAlert size={18} />
            Admin
            {snapshot.unmatchedCount > 0 ? <span>{snapshot.unmatchedCount}</span> : null}
          </a>
          <button className="primary-button" onClick={() => openReport()}>
            <PackagePlus size={18} />
            Report
          </button>
        </div>
      </header>

      <section className="metrics-row" aria-label="MVP metrics">
        <Metric label="Reports" value={snapshot.metrics.reportsSubmitted} />
        <Metric label="Contributors" value={snapshot.metrics.uniqueContributors} />
        <Metric label="Repeat" value={snapshot.metrics.repeatContributors} />
        <Metric label="Updates" value={snapshot.metrics.storeUpdates} />
        <Metric label="Reports/User" value={snapshot.metrics.reportsPerActiveUser} />
      </section>

      <section className="workspace">
        <aside className="store-list" aria-label="Stores">
          <label className="search-box">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search stores"
            />
          </label>

          <div className="store-scroll">
            {filteredStores.map((store) => {
              const reports = reportsByStore.get(store.id) ?? [];
              const isActive = selectedStoreId === store.id;
              return (
                <button
                  className={`store-row ${isActive ? "active" : ""}`}
                  key={store.id}
                  onClick={() => setSelectedStoreId(store.id)}
                >
                  <StoreIcon size={18} />
                  <span>
                    <strong>{store.name}</strong>
                    <small>{reports.length ? `${reports.length} recent sightings` : "No sightings yet"}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <StoreMap
          stores={snapshot.stores}
          reportsByStore={reportsByStore}
          selectedStoreId={selectedStoreId}
          onSelectStore={setSelectedStoreId}
        />

        <aside className="detail-panel" aria-label="Store details">
          {selectedStore ? (
            <>
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">{formatRetailer(selectedStore.retailerType)}</p>
                  <h2>{selectedStore.name}</h2>
                  <p className="muted">{selectedStore.address}</p>
                </div>
                <button className="icon-button" onClick={() => openReport(selectedStore.id)} title="Submit report">
                  <PackagePlus size={19} />
                </button>
              </div>

              <div className="report-stack">
                {selectedReports.length ? (
                  selectedReports.map((report) => (
                    <ReportCard
                      key={report.id}
                      report={report}
                      onUpdate={(status) => sendReportUpdate(report.id, status)}
                    />
                  ))
                ) : (
                  <div className="empty-state">
                    <CircleHelp size={22} />
                    <span>No recent sightings at this store.</span>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </aside>
      </section>

      <section className="activity-band">
        <div className="section-heading">
          <Activity size={20} />
          <h2>Recent Activity</h2>
        </div>
        <div className="activity-list">
          {snapshot.recentReports.map((report) => (
            <article className="activity-item" key={report.id}>
              <StatusIcon status={report.status} />
              <div>
                <strong>{displayProduct(report)}</strong>
                <p>
                  {report.store.name} · {formatStatus(report.status)} · {timeAgo(report.createdAt)}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {isReportOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Submit report">
          <form className="report-modal" onSubmit={submitReport}>
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Fast report</p>
                <h2>Submit a sighting</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setIsReportOpen(false)} title="Close">
                <XCircle size={20} />
              </button>
            </div>

            <label>
              Store
              <select
                value={form.storeId}
                onChange={(event) => setForm({ ...form, storeId: event.target.value })}
                required
              >
                {snapshot.stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Product
              <input
                value={form.rawProductText}
                onChange={(event) => setForm({ ...form, rawProductText: event.target.value })}
                placeholder="151 booster bundle, PE ETB, mystery tin..."
                required
              />
            </label>

            <div className="form-grid">
              <label>
                Quantity
                <input
                  min="0"
                  type="number"
                  value={form.quantityObserved}
                  onChange={(event) => setForm({ ...form, quantityObserved: event.target.value })}
                  placeholder="Optional"
                />
              </label>
              <label>
                Price
                <input
                  value={form.rawPrice}
                  onChange={(event) => setForm({ ...form, rawPrice: event.target.value })}
                  placeholder="Optional"
                />
              </label>
            </div>

            <label>
              Status
              <select
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value as ReportStatus })}
              >
                <option value="in_stock">In stock</option>
                <option value="low_stock">Low stock</option>
                <option value="sold_out">Sold out</option>
                <option value="unknown">Unknown</option>
              </select>
            </label>

            <label>
              Photo URL placeholder
              <input
                value={form.photoUrl}
                onChange={(event) => setForm({ ...form, photoUrl: event.target.value })}
                placeholder="Upload later"
              />
            </label>

            <button className="primary-button full" disabled={isSubmitting} type="submit">
              <PackagePlus size={18} />
              {isSubmitting ? "Submitting" : "Submit report"}
            </button>
          </form>
        </div>
      ) : null}
    </main>
  );
}

function StoreMap({
  stores,
  reportsByStore,
  selectedStoreId,
  onSelectStore
}: {
  stores: Store[];
  reportsByStore: Map<string, EnrichedReport[]>;
  selectedStoreId: string;
  onSelectStore: (storeId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("mapbox-gl").Map | null>(null);
  const markersRef = useRef<import("mapbox-gl").Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;

    let cancelled = false;

    import("mapbox-gl").then((mapboxgl) => {
      if (cancelled || !containerRef.current) return;

      mapboxgl.default.accessToken = token;
      mapRef.current = new mapboxgl.default.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [-73.78, 42.72],
        zoom: 10.2
      });
      mapRef.current.addControl(new mapboxgl.default.NavigationControl({ showCompass: false }), "top-right");
      setMapReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !mapReady || !mapRef.current) return;

    let cancelled = false;

    import("mapbox-gl").then((mapboxgl) => {
      if (cancelled || !mapRef.current) return;

      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = stores.map((store) => {
        const reports = reportsByStore.get(store.id) ?? [];
        const hasActivity = reports.some(
          (report) => Date.now() - Date.parse(report.createdAt) < 1000 * 60 * 60 * 24
        );
        const element = document.createElement("button");
        element.className = `mapbox-store-marker ${hasActivity ? "hot" : ""} ${
          selectedStoreId === store.id ? "active" : ""
        }`;
        element.type = "button";
        element.title = store.name;
        element.innerHTML = `<span>${reports.length}</span>`;
        element.addEventListener("click", () => onSelectStore(store.id));

        return new mapboxgl.default.Marker({ element })
          .setLngLat([store.longitude, store.latitude])
          .addTo(mapRef.current!);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [mapReady, onSelectStore, reportsByStore, selectedStoreId, stores, token]);

  return (
    <section className="map-stage" aria-label="Store map">
      {token ? (
        <div className="mapbox-container" ref={containerRef} />
      ) : (
        <div className="map-token-empty">
          <StoreIcon size={28} />
          <strong>Mapbox token required</strong>
          <span>Add NEXT_PUBLIC_MAPBOX_TOKEN to .env.local to render the live map.</span>
        </div>
      )}
      <div className="map-legend">
        <span>
          <i className="dot hot" /> Recent activity
        </span>
        <span>
          <i className="dot quiet" /> No current report
        </span>
      </div>
    </section>
  );
}

function ReportCard({
  report,
  onUpdate
}: {
  report: EnrichedReport;
  onUpdate: (status: ReportUpdateStatus) => void;
}) {
  return (
    <article className="report-card">
      <div className="report-topline">
        <StatusIcon status={report.status} />
        <div>
          <strong>{displayProduct(report)}</strong>
          <p>{formatStatus(report.status)} · {timeAgo(report.createdAt)}</p>
        </div>
      </div>
      <div className="report-meta">
        <span>
          <Boxes size={14} />
          {report.quantityObserved ?? "?"} seen
        </span>
        <span>{report.rawPrice ? `$${stripDollar(report.rawPrice)}` : "Price unknown"}</span>
        <span>{report.matchMethod === "unmatched" ? "Needs match" : "Matched"}</span>
      </div>
      <div className="update-actions">
        <button onClick={() => onUpdate("still_there")}>
          <CheckCircle2 size={16} />
          Still
        </button>
        <button onClick={() => onUpdate("gone")}>
          <XCircle size={16} />
          Gone
        </button>
        <button onClick={() => onUpdate("restocked")}>
          <RefreshCw size={16} />
          Restocked
        </button>
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function StatusIcon({ status }: { status: ReportStatus }) {
  const className = `status-dot ${status}`;
  if (status === "sold_out") return <XCircle className={className} size={18} />;
  if (status === "low_stock") return <Clock3 className={className} size={18} />;
  if (status === "unknown") return <CircleHelp className={className} size={18} />;
  return <CheckCircle2 className={className} size={18} />;
}

function displayProduct(report: EnrichedReport) {
  return report.product?.canonicalName ?? report.rawProductText ?? "Unknown Pokemon product";
}

function formatRetailer(value: string) {
  return value.replaceAll("_", " ");
}

function formatStatus(value: ReportStatus) {
  return value.replaceAll("_", " ");
}

function timeAgo(value: string) {
  const minutes = Math.max(1, Math.round((Date.now() - Date.parse(value)) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function stripDollar(value: string) {
  return value.replace(/^\$/, "");
}

function getContributorId() {
  const storageKey = "inventory-radar-contributor-id";
  const existing = window.localStorage.getItem(storageKey);
  if (existing) return existing;

  const uuid =
    typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const contributorId = `anon_${uuid}`;
  window.localStorage.setItem(storageKey, contributorId);
  return contributorId;
}
