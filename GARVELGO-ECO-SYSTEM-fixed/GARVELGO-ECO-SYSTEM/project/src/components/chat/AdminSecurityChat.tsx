import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MessageSquare, X, Send, Truck, ClipboardList, Tag, Radio } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRole, canAccessChat } from '@/lib/rbac';
import { useAdminAuth } from '@/lib/adminAuth';
import {
  useAdminSecurityChat,
  isChatRole,
  CHAT_MAX_LENGTH,
  type ChatMessage,
  type ChatRole,
  type ChatTag,
} from '@/lib/chat';
import { fmtDate } from '@/lib/format';
import { Spinner } from '@/components/ui';

const ROLE_LABEL: Record<ChatRole, { en: string; am: string }> = {
  admin: { en: 'Admin', am: 'አስተዳዳሪ' },
  gatekeeper: { en: 'Security', am: 'ጥበቃ' },
};

interface TagOption {
  key: string;
  type: ChatTag['type'];
  value: string;
  label: string;
}

/**
 * Gate: renders nothing unless the person is signed in as an ACTIVE Admin or Security staff
 * user AND the current session role is Admin or Security. Cashiers never see it. The database
 * enforces the same rule independently (chat_list / chat_send), so hiding the UI is not the
 * only protection.
 */
export default function AdminSecurityChat() {
  const { role } = useRole();
  const { user, loading } = useAdminAuth();
  if (loading || !user) return null;
  if (!isChatRole(user.role) || !canAccessChat(role)) return null;
  return <ChatWidget userId={user.id} myRole={user.role} />;
}

function ChatWidget({ userId, myRole }: { userId: string; myRole: ChatRole }) {
  const [open, setOpen] = useState(false);
  const { messages, loading, sending, error, live, unread, send } = useAdminSecurityChat(userId, open);

  const [text, setText] = useState('');
  const [tag, setTag] = useState<ChatTag | null>(null);
  const [tagOpen, setTagOpen] = useState(false);
  const [options, setOptions] = useState<TagOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const other = myRole === 'admin' ? 'gatekeeper' : 'admin';

  // Auto-scroll: always on open, and on new messages when the reader is already near the bottom
  // (or when the new message is their own).
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!open || !el) return;
    const last = messages[messages.length - 1];
    if (stickToBottom.current || last?.sender_id === userId) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, open, userId]);

  useEffect(() => {
    if (open) {
      stickToBottom.current = true;
      window.setTimeout(() => {
        const el = listRef.current;
        if (el) el.scrollTop = el.scrollHeight;
        textRef.current?.focus();
      }, 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  // Truck plates and active dispatch references are loaded lazily when the tag picker opens.
  const loadOptions = useCallback(async () => {
    setOptionsLoading(true);
    const [veh, sales] = await Promise.all([
      supabase.from('vehicles').select('id, plate_number, driver_name').order('plate_number').limit(200),
      supabase
        .from('sales')
        .select('id, invoice_number, customer_name, dispatch_status, vehicle:vehicles(plate_number)')
        .in('dispatch_status', ['pending_verification', 'approved', 'exited'])
        .order('created_at', { ascending: false })
        .limit(50),
    ]);
    const next: TagOption[] = [];
    ((veh.data ?? []) as { id: string; plate_number: string; driver_name: string }[]).forEach((v) =>
      next.push({
        key: `truck:${v.plate_number}`,
        type: 'truck',
        value: v.plate_number,
        label: `${v.plate_number} · ${v.driver_name}`,
      }),
    );
    (
      (sales.data ?? []) as unknown as {
        id: string;
        invoice_number: string;
        customer_name: string;
        vehicle: { plate_number: string } | { plate_number: string }[] | null;
      }[]
    ).forEach((s) => {
      const v = Array.isArray(s.vehicle) ? s.vehicle[0] : s.vehicle;
      next.push({
        key: `dispatch:${s.invoice_number}`,
        type: 'dispatch',
        value: s.invoice_number,
        label: `${s.invoice_number} · ${s.customer_name}${v ? ` · ${v.plate_number}` : ''}`,
      });
    });
    setOptions(next);
    setOptionsLoading(false);
  }, []);

  useEffect(() => {
    if (tagOpen && options.length === 0) loadOptions();
  }, [tagOpen, options.length, loadOptions]);

  async function submit() {
    if (!text.trim() || sending) return;
    const ok = await send(text, tag);
    if (ok) {
      setText('');
      setTag(null);
      setTagOpen(false);
      stickToBottom.current = true;
      textRef.current?.focus();
    }
  }

  const timeOf = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="no-print">
      {/* Launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 text-slate-900 pl-4 pr-5 py-3 shadow-xl shadow-orange-500/30 hover:from-amber-400 hover:to-orange-400 transition-all focus:outline-none focus:ring-2 focus:ring-amber-300"
          aria-label="Open Admin–Security chat"
        >
          <span className="relative">
            <MessageSquare className="w-5 h-5" strokeWidth={2.4} />
            {unread > 0 && (
              <span className="absolute -top-2.5 -right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </span>
          <span className="text-sm font-bold leading-tight text-left">
            Chat
            <span className="am block text-[10px] font-semibold text-slate-800/80">ውይይት</span>
          </span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Admin and Security chat"
          className="fixed z-50 inset-x-3 bottom-3 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[400px] h-[min(620px,calc(100vh-1.5rem))] flex flex-col rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl shadow-slate-900/30 animate-fade-in-up"
        >
          <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0">
              <MessageSquare className="w-5 h-5 text-slate-900" strokeWidth={2.4} />
            </div>
            <div className="flex-1 min-w-0 leading-tight">
              <div className="text-sm font-bold truncate">
                {ROLE_LABEL.admin.en} ↔ {ROLE_LABEL.gatekeeper.en}
              </div>
              <div className="am text-[11px] text-slate-300 truncate">
                {ROLE_LABEL.admin.am} ↔ {ROLE_LABEL.gatekeeper.am} · ግል ውይይት
              </div>
            </div>
            <span
              className={`flex items-center gap-1 text-[10px] font-semibold ${live ? 'text-emerald-300' : 'text-slate-400'}`}
              title={live ? 'Live connection' : 'Reconnecting — messages refresh every few seconds'}
            >
              <Radio className="w-3.5 h-3.5" />
              {live ? 'Live' : 'Sync'}
            </span>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-4 py-1.5 text-[11px] bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border-b border-amber-100 dark:border-amber-500/20">
            You are chatting with <b>{ROLE_LABEL[other].en}</b>{' '}
            <span className="am">({ROLE_LABEL[other].am})</span>
          </div>

          <div
            ref={listRef}
            onScroll={onScroll}
            className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-slate-50 dark:bg-slate-950"
          >
            {loading && (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            )}
            {!loading && messages.length === 0 && !error && (
              <div className="text-center py-12 text-slate-400 dark:text-slate-500">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-60" />
                <p className="text-sm font-semibold">No messages yet</p>
                <p className="am text-xs mt-0.5">እስካሁን መልዕክት የለም</p>
              </div>
            )}
            {messages.map((m, i) => (
              <Bubble
                key={m.id}
                m={m}
                mine={m.sender_id === userId}
                showDay={i === 0 || fmtDate(messages[i - 1].created_at) !== fmtDate(m.created_at)}
                time={timeOf(m.created_at)}
              />
            ))}
          </div>

          {error && (
            <div className="px-4 py-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-t border-red-100 dark:border-red-500/20">
              {error}
            </div>
          )}

          {/* Composer */}
          <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2">
            {tag && (
              <div className="flex items-center gap-1.5">
                <TagChip tag={tag} />
                <button
                  onClick={() => setTag(null)}
                  className="p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label="Remove tag"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {tagOpen && (
              <select
                value={tag ? `${tag.type}:${tag.value}` : ''}
                onChange={(e) => {
                  const o = options.find((x) => x.key === e.target.value);
                  setTag(o ? { type: o.type, value: o.value } : null);
                  if (o) setTagOpen(false);
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="">
                  {optionsLoading ? 'Loading…' : 'Tag a truck or dispatch… / መኪና ወይም ዝውውር ምረጥ'}
                </option>
                <optgroup label="Trucks · መኪናዎች">
                  {options
                    .filter((o) => o.type === 'truck')
                    .map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Dispatch / Invoice · ዝውውር">
                  {options
                    .filter((o) => o.type === 'dispatch')
                    .map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                </optgroup>
              </select>
            )}
            <div className="flex items-end gap-2">
              <button
                onClick={() => setTagOpen((v) => !v)}
                className={`p-2.5 rounded-xl border transition-colors ${
                  tagOpen || tag
                    ? 'border-amber-400 bg-amber-50 dark:bg-amber-500/10 text-amber-600'
                    : 'border-slate-300 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                aria-label="Tag truck or dispatch"
                title="Tag truck / dispatch"
              >
                <Tag className="w-4 h-4" />
              </button>
              <textarea
                ref={textRef}
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, CHAT_MAX_LENGTH))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                rows={1}
                placeholder="Type a message… / መልዕክት ይጻፉ…"
                className="flex-1 resize-none max-h-28 px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
              />
              <button
                onClick={submit}
                disabled={!text.trim() || sending}
                className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-slate-900 shadow-md shadow-orange-500/20 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                aria-label="Send message"
              >
                {sending ? <Spinner className="!text-slate-900" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TagChip({ tag }: { tag: ChatTag }) {
  const Icon = tag.type === 'truck' ? Truck : ClipboardList;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300 px-2.5 py-0.5 text-[11px] font-semibold">
      <Icon className="w-3 h-3" />
      {tag.type === 'truck' ? 'Truck' : 'Dispatch'}: <span className="font-mono">{tag.value}</span>
    </span>
  );
}

function Bubble({ m, mine, showDay, time }: { m: ChatMessage; mine: boolean; showDay: boolean; time: string }) {
  const label = ROLE_LABEL[m.sender_role];
  return (
    <>
      {showDay && (
        <div className="text-center text-[10px] font-semibold text-slate-400 dark:text-slate-500 py-1">
          {fmtDate(m.created_at)}
        </div>
      )}
      <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
            mine
              ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-slate-900 rounded-br-md'
              : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-md'
          }`}
        >
          {!mine && (
            <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400 mb-0.5">
              {m.sender_name ?? label.en} · {label.en} <span className="am font-normal">{label.am}</span>
            </div>
          )}
          {m.tag_type && m.tag_value && (
            <div className="mb-1">
              <TagChip tag={{ type: m.tag_type, value: m.tag_value }} />
            </div>
          )}
          <div className="whitespace-pre-wrap break-words">{m.message}</div>
          <div className={`text-[10px] mt-1 text-right ${mine ? 'text-slate-800/70' : 'text-slate-400'}`}>{time}</div>
        </div>
      </div>
    </>
  );
}
