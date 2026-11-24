import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

export type ChatRole = 'admin' | 'gatekeeper';
export type ChatTagType = 'truck' | 'dispatch';

export interface ChatMessage {
  id: string;
  sender_id: string;
  sender_role: ChatRole;
  recipient_role: ChatRole;
  message: string;
  tag_type: ChatTagType | null;
  tag_value: string | null;
  created_at: string;
  sender_name: string | null;
}

export interface ChatTag {
  type: ChatTagType;
  value: string;
}

export const CHAT_ROLES: readonly ChatRole[] = ['admin', 'gatekeeper'];
export const CHAT_MAX_LENGTH = 1000;

export function isChatRole(role: string | null | undefined): role is ChatRole {
  return role === 'admin' || role === 'gatekeeper';
}

const seenKey = (userId: string) => `garvelgo:chat-seen:${userId}`;

function mergeMessages(prev: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const map = new Map<string, ChatMessage>();
  prev.forEach((m) => map.set(m.id, m));
  incoming.forEach((m) => map.set(m.id, m));
  return Array.from(map.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

/**
 * Live Admin <-> Security chat for one signed-in staff user.
 * All access is mediated by the chat_list / chat_send database functions, which re-check
 * the staff role server-side. Realtime: a content-free `chat_events` ping triggers a refetch,
 * with a slow poll as a fallback if Realtime is not enabled.
 */
export function useAdminSecurityChat(userId: string, open: boolean) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [seenAt, setSeenAt] = useState<string>(() => {
    try {
      return window.localStorage.getItem(seenKey(userId)) ?? '';
    } catch {
      return '';
    }
  });
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    const { data, error: err } = await supabase.rpc('chat_list', { p_user_id: userId, p_limit: 200 });
    loadingRef.current = false;
    if (err) {
      setError(
        err.code === '42501'
          ? 'Access denied. Only Admin and Security staff can use this chat.'
          : 'Could not load messages. Retrying…',
      );
      setLoading(false);
      return;
    }
    setError(null);
    setMessages((data ?? []) as ChatMessage[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    load();

    const channel = supabase
      .channel(`admin-security-chat-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_events' }, () => {
        load();
      })
      .subscribe((status) => setLive(status === 'SUBSCRIBED'));

    const timer = window.setInterval(load, 10000);
    return () => {
      window.clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [load]);

  const markSeen = useCallback(() => {
    const now = new Date().toISOString();
    try {
      window.localStorage.setItem(seenKey(userId), now);
    } catch {
      /* storage unavailable — badge simply resets on reload */
    }
    setSeenAt(now);
  }, [userId]);

  // While the panel is open, everything on screen counts as read.
  useEffect(() => {
    if (open && messages.length > 0) markSeen();
  }, [open, messages.length, markSeen]);

  const send = useCallback(
    async (text: string, tag: ChatTag | null): Promise<boolean> => {
      const body = text.trim();
      if (!body) return false;
      setSending(true);
      setError(null);
      const { data, error: err } = await supabase.rpc('chat_send', {
        p_user_id: userId,
        p_message: body,
        p_tag_type: tag?.type ?? null,
        p_tag_value: tag?.value ?? null,
      });
      setSending(false);
      if (err) {
        setError(err.code === '42501' ? 'Access denied.' : 'Message not sent. Please try again.');
        return false;
      }
      const rows = (data ?? []) as ChatMessage[];
      if (rows.length > 0) setMessages((prev) => mergeMessages(prev, rows));
      return true;
    },
    [userId],
  );

  const unread = messages.filter(
    (m) => m.sender_id !== userId && (!seenAt || new Date(m.created_at) > new Date(seenAt)),
  ).length;

  return { messages, loading, sending, error, live, unread, send };
}
