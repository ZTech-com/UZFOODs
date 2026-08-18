import { BadRequestException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus } from '../common/order-status';

// ─────────────────────────── Test yordamchilari ───────────────────────────

function makeMenuItem(id: number, name: string, price: number) {
  return {
    id,
    name,
    description: null,
    price,
    imageUrl: null,
    category: 'Asosiy taomlar',
    available: true,
    createdAt: new Date(),
  };
}

function makeOrder(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    customerId: 1,
    customer: {
      id: 1,
      name: 'Aziza Karimova',
      phone: '+998901234567',
      telegramUsername: null,
      createdAt: new Date(),
    },
    totalAmount: 85000,
    requiredTime: '13:30',
    status: OrderStatus.PENDING,
    telegramMessageId: null,
    createdAt: new Date('2026-08-18T09:47:03.000Z'),
    updatedAt: new Date('2026-08-18T09:47:03.000Z'),
    items: [
      {
        id: 1,
        orderId: 1,
        menuItemId: 1,
        quantity: 2,
        price: 30000,
        menuItem: makeMenuItem(1, 'Osh', 30000),
      },
      {
        id: 2,
        orderId: 1,
        menuItemId: 2,
        quantity: 1,
        price: 25000,
        menuItem: makeMenuItem(2, "Lag'mon", 25000),
      },
    ],
    ...overrides,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createService(overrides: {
  menuItems?: unknown[];
  customer?: unknown | null;
  order?: unknown;
  findUniqueResult?: unknown | null;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = {
    menuItem: { findMany: jest.fn().mockResolvedValue(overrides.menuItems ?? []) },
    customer: {
      findUnique: jest.fn().mockResolvedValue(overrides.customer ?? null),
      create: jest.fn().mockResolvedValue({
        id: 1,
        name: 'Aziza Karimova',
        phone: '+998901234567',
        telegramUsername: null,
        createdAt: new Date(),
      }),
    },
    order: {
      create: jest.fn().mockResolvedValue(overrides.order ?? makeOrder()),
      findUnique: jest
        .fn()
        .mockResolvedValue(
          overrides.findUniqueResult !== undefined
            ? overrides.findUniqueResult
            : overrides.order ?? makeOrder(),
        ),
      update: jest.fn(),
    },
    orderStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
  };

  const gateway = {
    emitOrderCreated: jest.fn(),
    emitOrderUpdated: jest.fn(),
  };

  const queue = {
    add: jest.fn().mockResolvedValue(undefined),
    onModuleDestroy: jest.fn(),
  };

  const { OrderStatusService } = require('../status/order-status.service');
  const eventEmitter = { emit: jest.fn() };
  const statusService = new OrderStatusService(prisma, gateway, eventEmitter);

  const service = new OrdersService(
    prisma as never,
    gateway as never,
    statusService as never,
    queue as never,
  );

  return { prisma, gateway, queue, service, eventEmitter };
}

const validDto: CreateOrderDto = {
  customer: { name: 'Aziza Karimova', phone: '+998901234567' },
  requiredTime: '13:30',
  items: [
    { menuItemId: 1, quantity: 2 },
    { menuItemId: 2, quantity: 1 },
  ],
};

// ─────────────────────────────────── Testlar ───────────────────────────────────

describe('OrdersService.create', () => {
  it('jami summani to\'g\'ri hisoblaydi va buyurtma yaratadi', async () => {
    const { prisma, gateway, queue, service } = createService({
      menuItems: [makeMenuItem(1, 'Osh', 30000), makeMenuItem(2, "Lag'mon", 25000)],
      order: makeOrder(),
    });

    const result = await service.create(validDto);

    expect(prisma.customer.findUnique).toHaveBeenCalledWith({
      where: { phone: '+998901234567' },
    });
    expect(prisma.customer.create).toHaveBeenCalled();
    // 30000*2 + 25000*1 = 85000
    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ totalAmount: 85000 }),
      }),
    );
    expect(result.totalAmount).toBe(85000);
    expect(queue.add).toHaveBeenCalledWith(1);
    expect(gateway.emitOrderCreated).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
    );
  });

  it('mavjud bo\'lmagan taom bo\'lsa xato tashlaydi', async () => {
    const { service } = createService({
      menuItems: [makeMenuItem(1, 'Osh', 30000)], // 2-taom yo'q
    });

    await expect(service.create(validDto)).rejects.toThrow(BadRequestException);
  });

  it('idempotency: bir xil kalit bilan mavjud buyurtma qaytariladi', async () => {
    const existing = makeOrder();
    const { prisma, service } = createService({
      menuItems: [makeMenuItem(1, 'Osh', 30000)],
      order: existing,
    });
    prisma.order.findUnique.mockResolvedValue(existing);

    const result = await service.create(
      { ...validDto, items: [{ menuItemId: 1, quantity: 1 }] },
      'same-key',
    );

    expect(result.id).toBe(existing.id);
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it('mavjud mijozni qayta yaratmaydi', async () => {
    const existingCustomer = {
      id: 5,
      name: 'Aziza Karimova',
      phone: '+998901234567',
      telegramUsername: null,
      createdAt: new Date(),
    };
    const { prisma, service } = createService({
      menuItems: [makeMenuItem(1, 'Osh', 30000), makeMenuItem(2, "Lag'mon", 25000)],
      customer: existingCustomer,
      order: makeOrder(),
    });

    await service.create(validDto);

    expect(prisma.customer.create).not.toHaveBeenCalled();
    expect(prisma.customer.findUnique).toHaveBeenCalled();
  });
});

describe('OrdersService.updateStatus', () => {
  it('ruxsat etilgan o\'tishni bajaradi va socket xabar yuboradi', async () => {
    const order = makeOrder();
    const { prisma, gateway, service } = createService({ order });

    prisma.order.update.mockResolvedValue(
      makeOrder({ status: OrderStatus.PREPARING }),
    );

    const result = await service.updateStatus(1, OrderStatus.PREPARING);

    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: OrderStatus.PREPARING, cancelledReason: null },
      include: expect.anything(),
    });
    expect(result.status).toBe(OrderStatus.PREPARING);
    expect(gateway.emitOrderUpdated).toHaveBeenCalled();
  });

  it('ruxsat etilmagan o\'tishni rad etadi (PENDING → READY)', async () => {
    const { service } = createService({ order: makeOrder() });

    await expect(service.updateStatus(1, OrderStatus.READY)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('bekor qilingan buyurtmani o\'zgartirib bo\'lmaydi', async () => {
    const { service } = createService({
      order: makeOrder({ status: OrderStatus.CANCELLED }),
    });

    await expect(service.updateStatus(1, OrderStatus.PREPARING)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('topilmagan buyurtma uchun xato tashlaydi', async () => {
    const { service } = createService({
      findUniqueResult: null,
    });

    await expect(service.updateStatus(999, OrderStatus.PREPARING)).rejects.toThrow(
      'Buyurtma topilmadi',
    );
  });
});
