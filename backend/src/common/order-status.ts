/**
 * Buyurtma holatlari — DB provayderiga bog'liq bo'lmagan yagona manba.
 * PostgreSQL'da Prisma enum, SQLite'da String sifatida saqlanadi;
 * kod ikkala holatda ham shu konstantalardan foydalanadi.
 */
export const OrderStatus = {
  PENDING: 'PENDING',
  PREPARING: 'PREPARING',
  READY: 'READY',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

/** Ruxsat etilgan holat o'tishlari (qat'iy zanjir) */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  PREPARING: [OrderStatus.READY, OrderStatus.CANCELLED],
  READY: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
};
