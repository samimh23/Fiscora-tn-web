import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import {
  readSession,
  SESSION_CHANGED_EVENT,
} from "../api/client";

export interface RealtimePortalMessage {
  id: string;
  dossierId: string;
  senderUserId: string;
  senderName: string;
  senderRole: string;
  body: string;
  clientReadAtUtc: string | null;
  cabinetReadAtUtc: string | null;
  createdAtUtc: string;
}

interface MessageCreatedEvent {
  organizationId: string;
  dossierId: string;
  message: RealtimePortalMessage;
}

const API_ORIGIN = (() => {
  const configured = (import.meta.env.VITE_API_URL ?? "").trim();
  if (!configured) return window.location.origin;
  return new URL(configured, window.location.origin).origin;
})();

let socket: Socket | null = null;
let sessionListenerInstalled = false;

function currentSocket() {
  if (!socket) {
    socket = io(`${API_ORIGIN}/client-portal`, {
      autoConnect: Boolean(readSession()?.accessToken),
      auth: (done) => done({ token: readSession()?.accessToken }),
      transports: ["websocket", "polling"],
    });
  }
  if (!sessionListenerInstalled) {
    window.addEventListener(SESSION_CHANGED_EVENT, reconnectForSession);
    sessionListenerInstalled = true;
  }
  return socket;
}

function reconnectForSession() {
  if (!socket) return;
  socket.disconnect();
  if (readSession()?.accessToken) socket.connect();
}

function appendMessage(
  current: RealtimePortalMessage[] | undefined,
  message: RealtimePortalMessage,
) {
  if (!current) return [message];
  if (current.some((item) => item.id === message.id)) return current;
  return [...current, message];
}

export function useClientPortalMessageRoom(
  organizationId: string,
  dossierId: string,
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!organizationId || !dossierId || !readSession()?.accessToken) return;
    const liveSocket = currentSocket();
    const room = { organizationId, dossierId };
    const subscribe = () => liveSocket.emit("client_portal.subscribe", room);
    const receive = (event: MessageCreatedEvent) => {
      if (
        event.organizationId !== organizationId ||
        event.dossierId !== dossierId
      ) {
        return;
      }
      queryClient.setQueryData<RealtimePortalMessage[]>(
        ["dossier-client-messages", organizationId, dossierId],
        (current) => appendMessage(current, event.message),
      );
      queryClient.setQueryData<RealtimePortalMessage[]>(
        ["portal-messages", organizationId, dossierId],
        (current) => appendMessage(current, event.message),
      );
    };

    liveSocket.on("connect", subscribe);
    liveSocket.on("client_portal.message.created", receive);
    if (liveSocket.connected) subscribe();
    else liveSocket.connect();

    return () => {
      if (liveSocket.connected) {
        liveSocket.emit("client_portal.unsubscribe", room);
      }
      liveSocket.off("connect", subscribe);
      liveSocket.off("client_portal.message.created", receive);
    };
  }, [dossierId, organizationId, queryClient]);
}

export function useClientPortalRealtimeNotifications() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!readSession()?.accessToken) return;
    const liveSocket = currentSocket();
    const receive = (event: MessageCreatedEvent) => {
      void queryClient.invalidateQueries({
        queryKey: ["cabinet-notifications", event.organizationId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["client-notifications"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["client-portal-notifications", event.organizationId],
      });
    };
    liveSocket.on("client_portal.message.created", receive);
    if (!liveSocket.connected) liveSocket.connect();
    return () => {
      liveSocket.off("client_portal.message.created", receive);
    };
  }, [queryClient]);
}
