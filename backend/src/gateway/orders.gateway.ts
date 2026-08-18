import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SerializedOrder } from '../common/serialize';

@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    credentials: true,
  },
})
export class OrdersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    client.emit('connected', { message: 'Admin panel real-vaqt ulanishi o\'rnatildi' });
  }

  handleDisconnect(_client: Socket) {
    // hech narsa qilish shart emas
  }

  /** Yangi buyurtma tushganda admin panelga xabar */
  emitOrderCreated(order: SerializedOrder) {
    this.server?.emit('order.created', order);
  }

  /** Buyurtma holati o'zgarganda admin panelga xabar */
  emitOrderUpdated(order: SerializedOrder) {
    this.server?.emit('order.updated', order);
  }
}
