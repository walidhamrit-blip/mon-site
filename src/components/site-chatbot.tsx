"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, RotateCcw, Send, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSiteConfig } from "@/components/site-provider";
import { whatsappLink } from "@/lib/utils";
import {
  buildChatNodes,
  matchChatNode,
  START_NODES,
  type ChatNode,
} from "@/lib/chatbot";

interface Message {
  key: number;
  role: "bot" | "user";
  text: string;
  action?: ChatNode["action"];
}

/**
 * Avatar Einstein du assistant. L'image est harmonisée avec le thème
 * actif : un calque couleur (`mix-blend-mode: color`) teinté par
 * `--accent` se superpose au portrait, et l'anneau suit la palette
 * choisie (or, bleu, émeraude…). Aucun code couleur en dur.
 */
function EinsteinAvatar({
  className = "",
  imgClassName = "",
}: {
  className?: string;
  imgClassName?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`isolate relative block overflow-hidden rounded-full bg-[var(--secondary)] ${className}`}
    >
      <Image
        src="/chatbot/einstein-96.webp"
        alt=""
        width={96}
        height={96}
        loading="eager"
        decoding="async"
        className={`h-full w-full object-cover ${imgClassName}`}
      />
      <span className="chatbot-tint pointer-events-none absolute inset-0" />
    </span>
  );
}

/**
 * Petit assistant du site : il propose des questions, répond avec les
 * données réelles (prix, délais, paiement crypto) puis enchaîne sur les questions
 * de suivi. Aucun appel réseau, aucune clé API — la conversation est un
 * arbre de décision local (voir src/lib/chatbot.ts).
 */
export function SiteChatbot() {
  const { locale } = useI18n();
  // `key` : la conversation repart de zéro quand le visiteur change de
  // langue (état initial calculé au montage, sans effet ni double rendu).
  return <ChatShell key={locale} />;
}

function ChatShell() {
  const siteConfig = useSiteConfig();
  const { locale } = useI18n();
  const ar = locale === "ar";
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      key: 0,
      role: "bot",
      text:
        locale === "ar"
          ? "مرحبًا 👋 أنا مساعد نخبة. اختر سؤالًا وسأجيبك فورًا."
          : "Hi 👋 I'm the Nukhba assistant. Pick a question and I'll answer right away.",
    },
  ]);
  const [suggestions, setSuggestions] = useState<string[]>([...START_NODES]);
  const [bubble, setBubble] = useState(false);
  // Le visiteur a-t-il déjà ouvert l'assistant ? La bulle d'accueil
  // n'a plus lieu d'être après une première ouverture.
  const openedOnce = useRef(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const nextKey = useRef(1);

  const nodes = useMemo(
    () =>
      buildChatNodes({
        locale,
        plans: siteConfig.pricing.plans,
        currency: siteConfig.pricing.currency,
        currencyEn: siteConfig.pricing.currencyEn,
        whatsappHref: whatsappLink(
          siteConfig.whatsapp,
          ar
            ? "مرحبا نخبة 👋 لدي سؤال حول موقع لنشاطي."
            : "Hello Nukhba 👋 I have a question about a website for my business.",
        ),
        reservationUsd: siteConfig.reservation?.depositUsd ?? 1,
        hours: ar ? siteConfig.hours : siteConfig.hoursEn,
      }),
    [locale, siteConfig, ar],
  );

  // Garde le dernier message visible.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  // Échap ferme l'assistant.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Petite bulle d'accueil : elle apparaît peu après l'arrivée sur le
  // site puis repasse de temps en temps, pour signaler le assistant.
  // Dès que le visiteur ouvre la conversation une première fois, elle
  // ne revient plus (les minuteries sont aussi arrêtées à l'ouverture).
  useEffect(() => {
    if (open || openedOnce.current) return;
    let hide: number | undefined;
    const show = () => {
      setBubble(true);
      hide = window.setTimeout(() => setBubble(false), 9000);
    };
    const first = window.setTimeout(show, 1600);
    const loop = window.setInterval(show, 26000);
    return () => {
      window.clearTimeout(first);
      if (hide) window.clearTimeout(hide);
      window.clearInterval(loop);
    };
  }, [open]);

  const answer = (nodeId: string, userLabel?: string) => {
    const node = nodes[nodeId] ?? nodes.unknown;
    if (!node) return;

    const userMessage: Message[] = userLabel
      ? [{ key: nextKey.current++, role: "user", text: userLabel }]
      : [];
    setMessages((prev) => [...prev, ...userMessage]);
    setSuggestions([]);
    setTyping(true);

    // Petit délai : donne l'impression d'une vraie réponse (et laisse
    // apparaître l'indicateur de saisie).
    window.setTimeout(() => {
      setTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          key: nextKey.current++,
          role: "bot",
          text: node.answer,
          action: node.action,
        },
      ]);
      setSuggestions(node.followUps.filter((id) => nodes[id]));
    }, 380);
  };

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const value = input.trim();
    if (!value) return;
    setInput("");
    answer(matchChatNode(value, nodes), value);
  };

  const restart = () => {
    setMessages([
      {
        key: 0,
        role: "bot",
        text: ar
          ? "هيا بنا من جديد — اختر سؤالًا:"
          : "Let's start again — pick a question:",
      },
    ]);
    setSuggestions([...START_NODES]);
    setTyping(false);
    setInput("");
  };

  return (
    <div className="fixed bottom-[92px] end-5 z-[70] flex flex-col items-end gap-2 print:hidden">
      <AnimatePresence>
        {open && (
          <motion.section
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            role="dialog"
            aria-label={ar ? "مساعد نخبة" : "Nukhba assistant"}
            dir={ar ? "rtl" : "ltr"}
            className="mb-1 flex w-[calc(100vw-2rem)] max-w-[350px] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[0_18px_45px_rgba(0,0,0,0.18)]"
          >
            {/* En-tête */}
            <header className="flex items-center gap-2.5 border-b border-[var(--border)] bg-[var(--primary)] px-3 py-2.5 text-[var(--primary-foreground)]">
              <EinsteinAvatar className="h-9 w-9 shrink-0 ring-2 ring-[var(--accent)]" />
              <div className="min-w-0 flex-1 leading-tight">
                <div className="text-[13px] font-black">
                  {ar ? "مساعد نخبة" : "Nukhba assistant"}
                </div>
                <div className="flex items-center gap-1 text-[10px] opacity-70">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {ar ? "رد فوري — بدون انتظار" : "Instant answers"}
                </div>
              </div>
              <button
                type="button"
                onClick={restart}
                title={ar ? "إعادة البدء" : "Restart"}
                aria-label={ar ? "إعادة البدء" : "Restart"}
                className="grid h-7 w-7 place-items-center rounded-full opacity-70 hover:opacity-100 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={ar ? "إغلاق" : "Close"}
                className="grid h-7 w-7 place-items-center rounded-full opacity-70 hover:opacity-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            {/* Conversation */}
            <div
              ref={listRef}
              className="max-h-[min(52vh,360px)] space-y-2 overflow-y-auto px-3 py-3"
              aria-live="polite"
            >
              {messages.map((message) =>
                message.role === "bot" ? (
                  <div key={message.key} className="flex items-end gap-1.5">
                    <EinsteinAvatar className="h-6 w-6 shrink-0" />
                    <div className="min-w-0 space-y-1.5">
                      <div className="max-w-[92%] whitespace-pre-line rounded-2xl rounded-ss-sm bg-[var(--secondary)] px-3 py-2 text-[12.5px] leading-5">
                        {message.text}
                      </div>
                      {message.action && (
                        <a
                          href={message.action.href}
                          target={message.action.external ? "_blank" : undefined}
                          rel={message.action.external ? "noopener noreferrer" : undefined}
                          className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)] px-3 py-1.5 text-[11.5px] font-black text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] transition-colors"
                        >
                          {message.action.label}
                          <ArrowRight className="h-3 w-3 rtl:rotate-180" />
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  <div key={message.key} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-se-sm bg-[var(--primary)] px-3 py-2 text-[12.5px] leading-5 text-[var(--primary-foreground)]">
                      {message.text}
                    </div>
                  </div>
                ),
              )}

              {typing && (
                <div className="flex items-end gap-1.5">
                  <EinsteinAvatar className="h-6 w-6 shrink-0" />
                  <div className="flex w-14 items-center justify-center gap-1 rounded-2xl bg-[var(--secondary)] px-3 py-2.5">
                    {[0, 150, 300].map((delay) => (
                      <span
                        key={delay}
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--muted-foreground)]"
                        style={{ animationDelay: `${delay}ms` }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Questions proposées */}
            {suggestions.length > 0 && (
              <div className="flex max-h-[104px] flex-wrap gap-1.5 overflow-y-auto border-t border-[var(--border)] px-3 pb-2.5 pt-2">
                {suggestions.map((id) => {
                  const node = nodes[id];
                  if (!node) return null;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => answer(id, node.label)}
                      className="rounded-full border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-[11.5px] font-semibold hover:border-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors cursor-pointer"
                    >
                      {node.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Saisie libre */}
            <form
              onSubmit={send}
              className="flex items-center gap-1.5 border-t border-[var(--border)] px-2.5 py-2"
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={ar ? "اسأل سؤالك…" : "Ask your question…"}
                aria-label={ar ? "اكتب سؤالك" : "Type your question"}
                maxLength={160}
                className="h-9 min-w-0 flex-1 rounded-full border border-[var(--border)] bg-[var(--secondary)]/50 px-3 text-[12.5px] outline-none focus:border-[var(--accent)]"
              />
              <button
                type="submit"
                aria-label={ar ? "إرسال" : "Send"}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
              >
                <Send className="h-4 w-4 rtl:rotate-180" />
              </button>
            </form>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Lanceur — avatar Einstein flottant : lévitation douce, halo
          pulsant aux couleurs du thème, dandinement au survol et petite
          bulle d'accueil périodique. */}
      <div className={`relative ${open ? "" : "chatbot-float"}`}>
        {!open && (
          <span
            aria-hidden="true"
            className="chatbot-halo pointer-events-none absolute inset-0 rounded-full"
          />
        )}

        {/* Bulle d'accueil */}
        <AnimatePresence>
          {bubble && !open && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="pointer-events-none absolute bottom-2.5 end-[calc(100%+12px)] whitespace-nowrap rounded-full border border-[var(--border)] bg-[var(--popover)] px-3 py-1.5 text-[11.5px] font-bold text-[var(--popover-foreground)] shadow-[0_10px_25px_rgba(0,0,0,0.18)]"
            >
              {ar ? "مرحبًا 👋 عندك سؤال؟" : "Hi 👋 Got a question?"}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="button"
          onClick={() => {
            setOpen((v) => {
              if (!v) openedOnce.current = true;
              return !v;
            });
            setBubble(false);
            window.setTimeout(() => inputRef.current?.focus(), 120);
          }}
          aria-expanded={open}
          aria-label={ar ? "افتح مساعد نخبة" : "Open the Nukhba assistant"}
          className="group relative block h-14 w-14 cursor-pointer overflow-hidden rounded-full bg-[var(--secondary)] shadow-[0_8px_24px_rgba(0,0,0,0.25)] ring-2 ring-[var(--accent)] transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
        >
          <EinsteinAvatar
            className="chatbot-wiggle h-full w-full"
            imgClassName="transition-transform duration-200 group-hover:scale-110"
          />
          {open && (
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-[var(--background)]/45"
            />
          )}
          <span className="absolute -top-1 -end-1 grid h-5 w-5 place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] ring-2 ring-[var(--background)]">
            {open ? (
              <X className="h-3 w-3" />
            ) : (
              <span className="text-[10px] font-black">?</span>
            )}
          </span>
        </button>
      </div>
    </div>
  );
}
