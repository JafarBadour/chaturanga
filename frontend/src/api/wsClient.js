import { api } from "./client";

const subscribers = new Set();
const connectedListeners = new Set();

let ws = null;
let reconnectTimer = null;
let outboundQueue = [];
let intentionalClose = false;

function notifyConnected(connected) {
  connectedListeners.forEach((listener) => listener(connected));
}

function notifyMessage(data) {
  subscribers.forEach((handler) => handler(data));
}

function flushQueue() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  while (outboundQueue.length > 0) {
    ws.send(JSON.stringify(outboundQueue.shift()));
  }
}

function scheduleReconnect() {
  if (intentionalClose) return;
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connect, 3000);
}

function connect() {
  const token = localStorage.getItem("token");
  if (!token) return;

  intentionalClose = false;

  if (
    ws &&
    (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }

  ws = new WebSocket(api.getWsUrl());

  ws.onopen = () => {
    notifyConnected(true);
    flushQueue();
  };

  ws.onclose = () => {
    ws = null;
    notifyConnected(false);
    scheduleReconnect();
  };

  ws.onmessage = (event) => {
    try {
      notifyMessage(JSON.parse(event.data));
    } catch {
      /* ignore malformed messages */
    }
  };
}

function disconnect() {
  intentionalClose = true;
  clearTimeout(reconnectTimer);
  reconnectTimer = null;
  outboundQueue = [];

  if (ws) {
    ws.onclose = null;
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
    ws = null;
  }

  notifyConnected(false);
}

function send(payload) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
    return true;
  }

  outboundQueue.push(payload);
  connect();
  return false;
}

function subscribe(handler) {
  subscribers.add(handler);
  return () => subscribers.delete(handler);
}

function onConnectedChange(listener) {
  connectedListeners.add(listener);
  listener(ws?.readyState === WebSocket.OPEN);
  return () => connectedListeners.delete(listener);
}

export const wsClient = {
  connect,
  disconnect,
  send,
  subscribe,
  onConnectedChange,
};
