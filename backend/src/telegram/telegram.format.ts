import { InlineKeyboard } from 'grammy';
import { OrderStatus } from '../common/order-status';

export interface OrderForMessage {
  id: number;
  customer: {
    name: string;
    phone: string;
    telegramUsername?: string | null;
  };
  items: { name: string; quantity: number; price: number }[];
  totalAmount: number;
  requiredTime: string;
  createdAt: Date | string;
  status?: OrderStatus;
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: '⏳ Kutilmoqda',
  PREPARING: '👨‍🍳 Tayyorlanmoqda',
  READY: '✅ Tayyor',
  COMPLETED: '🏁 Yakunlandi',
  CANCELLED: '❌ Bekor qilingan',
};

/** "85000" → "85,000 so'm" */
export function formatSum(value: number | string): string {
  const n = Number(value);
  return `${n.toLocaleString('en-US')} so'm`;
}

/** Date → "12:47:03" (24 soatlik format) */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Telegram xabari matni — texnik topshiriq 5-bo'limidagi format bo'yicha:
 *
 * 🆕 YANGI BUYURTMA #1024
 * ...
 */
export function formatOrderMessage(order: OrderForMessage, includeStatus = false): string {
  const lines: string[] = [];

  lines.push(`🆕 YANGI BUYURTMA #${order.id}`);
  lines.push('');
  lines.push(`👤 Mijoz: ${order.customer.name}`);
  lines.push(`📞 Tel: ${order.customer.phone}`);
  if (order.customer.telegramUsername) {
    lines.push(`✈️ Telegram: @${order.customer.telegramUsername.replace(/^@/, '')}`);
  }
  lines.push('');
  lines.push('🍽 Taomlar:');
  for (const item of order.items) {
    lines.push(`- ${item.name} (${item.quantity} porsiya) — ${formatSum(item.price * item.quantity)}`);
  }
  lines.push('');
  lines.push(`💰 Jami: ${formatSum(order.totalAmount)}`);
  lines.push(`⏰ Qachon tayyor bo'lishi kerak: ${order.requiredTime}`);
  lines.push(`🕐 Buyurtma tushgan vaqt: ${formatTime(order.createdAt)}`);
  if (includeStatus && order.status) {
    lines.push(`📌 Holat: ${STATUS_LABELS[order.status]}`);
  }

  return lines.join('\n');
}

export type CallbackAction = 'accept' | 'reject' | 'ready' | 'complete';

/** Holatga mos inline tugmalar. Terminal holatlarda null qaytadi. */
export function buildOrderKeyboard(
  orderId: number,
  status: OrderStatus,
): InlineKeyboard | null {
  const kb = new InlineKeyboard();
  switch (status) {
    case 'PENDING':
      kb.text('✅ Qabul qilish', `accept:${orderId}`).text('❌ Bekor qilish', `reject:${orderId}`);
      break;
    case 'PREPARING':
      kb.text('👨‍🍳 Tayyor', `ready:${orderId}`).text('❌ Bekor qilish', `reject:${orderId}`);
      break;
    case 'READY':
      kb.text('🏁 Yakunlandi', `complete:${orderId}`);
      break;
    default:
      return null;
  }
  return kb;
}

/** Callback data'ni pars qilish: "accept:5" → { action: 'accept', orderId: 5 } */
export function parseCallbackData(
  data: string,
): { action: CallbackAction; orderId: number } | null {
  const [action, idStr] = data.split(':');
  const orderId = Number(idStr);
  const validActions: CallbackAction[] = ['accept', 'reject', 'ready', 'complete'];
  if (!orderId || !validActions.includes(action as CallbackAction)) {
    return null;
  }
  return { action: action as CallbackAction, orderId };
}
