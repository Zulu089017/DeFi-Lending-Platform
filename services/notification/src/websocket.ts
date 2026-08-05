// WebSocket Notification Service
// Pushes real-time updates to connected clients for events, price changes, and alerts.

import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";

const LOG_PREFIX = "[NotificationService]";

export interface Notification {
  type: "event" | "price" | "alert" | "liquidation";
  channel: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export class NotificationService {
  private wss!: WebSocketServer;
  private clients = new Map<string, Set<WebSocket>>();
  private port: number;

  constructor(port = 4200) {
    this.port = port;
  }

  start(): void {
    const server = createServer();
    this.wss = new WebSocketServer({ server });

    this.wss.on("connection", (ws, req) => {
      const clientId = `${req.socket.remoteAddress}:${Date.now()}`;
      ws.on("message", (data) => this.handleMessage(ws, clientId, data.toString()));
      ws.on("close", () => this.handleDisconnect(clientId));

      // Default channel: all events
      this.subscribe(clientId, ws, "all");
    });

    server.listen(this.port, () => {
      console.info(`${LOG_PREFIX} WebSocket server listening on :${this.port}`);
    });
  }

  private handleMessage(ws: WebSocket, clientId: string, raw: string): void {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === "subscribe" && msg.channel) {
        this.subscribe(clientId, ws, msg.channel);
      } else if (msg.type === "unsubscribe" && msg.channel) {
        this.unsubscribe(clientId, msg.channel);
      }
    } catch {
      // Ignore malformed messages
    }
  }

  private subscribe(clientId: string, ws: WebSocket, channel: string): void {
    if (!this.clients.has(channel)) {
      this.clients.set(channel, new Set());
    }
    this.clients.get(channel)!.add(ws);
  }

  private unsubscribe(clientId: string, channel: string): void {
    this.clients.get(channel)?.forEach((c) => {
      // In production: track per-client subscriptions
    });
  }

  private handleDisconnect(clientId: string): void {
    for (const [, clients] of this.clients) {
      clients.forEach((ws) => {
        if (ws.readyState === WebSocket.CLOSED) clients.delete(ws);
      });
    }
  }

  /** Broadcast a notification to all subscribers of a channel. */
  broadcast(notification: Notification): void {
    const msg = JSON.stringify(notification);
    const channels = [notification.channel, "all"];

    for (const channel of channels) {
      const subs = this.clients.get(channel);
      if (!subs) continue;

      for (const ws of subs) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(msg);
        }
      }
    }
  }

  /** Push a cross-chain event notification. */
  notifyEvent(event: { type: string; chain: string; txHash: string; amount: string }): void {
    this.broadcast({
      type: "event",
      channel: `events:${event.chain}`,
      payload: event as any,
      timestamp: new Date().toISOString(),
    });
  }

  /** Push a price update. */
  notifyPrice(asset: string, price: string, change24h: number): void {
    this.broadcast({
      type: "price",
      channel: `prices:${asset}`,
      payload: { asset, price, change24h },
      timestamp: new Date().toISOString(),
    });
  }

  /** Push a liquidation alert. */
  notifyLiquidation(position: { user: string; asset: string; amount: string }): void {
    this.broadcast({
      type: "liquidation",
      channel: "liquidations",
      payload: position as any,
      timestamp: new Date().toISOString(),
    });
  }
}

export const notifications = new NotificationService();
