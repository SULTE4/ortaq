import { useEffect, useState } from "react";
import { useView } from "./store";
import type { Snapshot } from "./types";
export const embed = new URLSearchParams(location.search).get("embed");
export const parentOrigins = [
  `http://${location.hostname}:8081`,
  `http://${location.hostname}:8082`,
  `http://${location.hostname}:8091`,
  `http://${location.hostname}:8092`,
  `http://127.0.0.1:8081`,
  `http://127.0.0.1:8082`,
  `http://127.0.0.1:8091`,
  `http://127.0.0.1:8092`,
  `http://localhost:8081`,
  `http://localhost:8082`,
  `http://localhost:8091`,
  `http://localhost:8092`,
];
export async function request(path: string, token = "", body?: unknown) {
  const response = await fetch("/api/v1" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const value = await response.json();
  if (!response.ok) {
    const error = Object.assign(Error(value.error ?? "Could not connect"), {
      status: response.status,
    });
    throw error;
  }
  return value;
}
export function useSession() {
  const [token, setToken] = useState(
    embed ? "" : (sessionStorage.getItem("ortaq-3d-token") ?? ""),
  );
  useEffect(() => {
    if (!embed) return;
    function receive(e: MessageEvent) {
      if (e.source !== window.parent || !parentOrigins.includes(e.origin))
        return;
      try {
        const v = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (v?.type === "ortaq:session" && typeof v.token === "string")
          setToken(v.token);
      } catch {}
    }
    window.addEventListener("message", receive);
    window.parent.postMessage(
      JSON.stringify({ type: "ortaq:ready" }),
      "*",
    );
    return () => window.removeEventListener("message", receive);
  }, []);
  useEffect(() => {
    if (!token || embed === "picker") return;
    let stopped = false,
      pending = false;
    async function sync() {
      if (pending) return;
      pending = true;
      try {
        const admin = embed === "admin" && useView.getState().balances;
        let data: Snapshot = await request(
          "/scene" + (admin ? "?balances=true" : ""),
          token,
        );
        if (import.meta.env.DEV && new URLSearchParams(location.search).get('planFixture') === '1') {
          data = (await import('./planFixture.dev')).withPlanFixture(data);
        }
        if (!stopped) {
          const current = useView.getState();
          current.set({
            snapshot: data,
            connected: true,
            ...(!current.month && data.reports.length
              ? { month: data.reports[0].month }
              : {}),
          });
        }
      } catch (e) {
        if (!stopped) {
          useView.getState().set({ connected: false });
          if ((e as { status?: number }).status === 401) {
            setToken("");
            if (!embed) sessionStorage.removeItem("ortaq-3d-token");
            useView.getState().set({ snapshot: null });
          }
        }
      } finally {
        pending = false;
      }
    }
    sync();
    const id = setInterval(sync, 3000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [token]);
  return {
    token,
    setToken: (v: string) => {
      setToken(v);
      if (!embed) sessionStorage.setItem("ortaq-3d-token", v);
    },
  };
}
