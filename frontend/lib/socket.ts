"use client";

import { io, type Socket } from "socket.io-client";
import { API_URL } from "./api";

let socket: Socket | null = null;

/** Bitta global socket ulanishi (admin panel real-vaqt yangilanishlar uchun) */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_URL, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      autoConnect: true,
    });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
