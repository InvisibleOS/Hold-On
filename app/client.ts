"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Household, Payment, Status } from "@/lib/store.ts";

export type HouseholdView = Household & { mode: "sandbox" | "demo"; ai: boolean; push: boolean; linked: boolean; paypalReady: boolean };

/** Polls the household every 1.5s while the tab is visible. */
export function useHousehold(h: string) {
  const [data, setData] = useState<HouseholdView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const r = await fetch(`/api/state?h=${encodeURIComponent(h)}`, { cache: "no-store" });
    if (r.ok) setData(await r.json());
  }, [h]);

  useEffect(() => {
    refresh();
    const t = setInterval(() => document.visibilityState === "visible" && refresh(), 1500);
    return () => clearInterval(t);
  }, [refresh]);

  /** POST to an API route; returns the fresh household or null on error. */
  const send = useCallback(
    async (path: string, body: object): Promise<HouseholdView | null> => {
      setBusy(true);
      setError(null);
      try {
        const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ h, ...body }) });
        const json = await r.json();
        if (!r.ok) {
          setError(json.error ?? "Something went wrong. Please try again.");
          return null;
        }
        setData(json);
        return json;
      } catch {
        setError("Couldn't reach Hold On. Check your connection and try again.");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [h],
  );

  return { data, error, busy, send, setError };
}

export const money = (amount: string | number) =>
  Number(amount).toLocaleString("en-US", { style: "currency", currency: "USD" });

export const ACTIVE: Status[] = ["checking", "asking", "held", "releasing"];
export const isActive = (p: Payment) => ACTIVE.includes(p.status);

export const STATUS_WORDS: Record<Status, string> = {
  checking: "Checking",
  asking: "Waiting for Rose",
  held: "Held — waiting for Maya",
  releasing: "Sending",
  sent: "Sent",
  delivered: "Delivered",
  blocked: "Stopped by Maya",
  cancelled: "Cancelled by Rose",
  expired: "Cancelled (no answer in time)",
  failed: "Didn't go through",
};

export function timeLeft(until?: number) {
  if (!until) return "";
  const ms = Math.max(0, until - Date.now());
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h ? `${h} h ${m} min` : `${m} min`;
}

// ---- Voice: the browser's own speech features, always optional ----

export function speak(text: string, lang = (typeof navigator !== "undefined" && navigator.language) || "en-US") {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = 0.92;
  window.speechSynthesis.speak(u);
}

type Recognition = { lang: string; interimResults: boolean; start(): void; stop(): void; onresult: ((e: any) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };

export function useDictation(onText: (t: string) => void) {
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    const w = window as any;
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);
  const toggle = () => {
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;
    if (listening) return rec.current?.stop();
    const r: Recognition = new SR();
    r.lang = navigator.language || "en-US";
    r.interimResults = false;
    r.onresult = (e) => onText(e.results[0][0].transcript);
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  };
  return { supported, listening, toggle };
}

// ---- Plain-language lessons shown after a scam is stopped ----

export const LESSONS: Record<string, { name: string; how: string }> = {
  grandparent_emergency: {
    name: "the grandparent scam",
    how: "Someone pretends to be a grandchild in trouble — sometimes with an AI copy of their voice — and begs you to send money fast and keep it secret. A real grandchild can wait five minutes while you call them back on their usual number.",
  },
  government_impersonation: {
    name: "a government impostor scam",
    how: "Real government offices never call, text or email demanding payment, and never ask for gift cards, crypto or secrecy. Hang up and call the office yourself using the number on their official website.",
  },
  tech_support_refund: {
    name: "a fake refund scam",
    how: "Scammers send real-looking invoices for things you never bought, with a phone number to call. The 'refund agent' then tricks you into sending them money. You never owe anything on an invoice you didn't agree to — just ignore it.",
  },
  fake_invoice: {
    name: "a fake invoice scam",
    how: "The email can really come from PayPal while the seller is a scammer. Don't pay it and don't call any number in it. You can report it from inside the PayPal app.",
  },
  romance: {
    name: "a romance scam",
    how: "A kind online friend you've never met in person suddenly needs money for travel, customs or an emergency. Someone who truly cares about you won't ask you for money.",
  },
  investment_crypto: {
    name: "an investment scam",
    how: "Promises of guaranteed or very high returns, often in crypto, are almost always a trick. Talk to someone you trust before investing anything.",
  },
  prize_lottery: {
    name: "a prize scam",
    how: "If you have to pay a fee to collect a prize, there is no prize. Real winnings never cost money to claim.",
  },
  agent_manipulation: {
    name: "a trick aimed at an AI assistant",
    how: "A web page hid instructions telling an AI helper to send money. Hold On checks payments from AI helpers the same way it checks yours.",
  },
};
