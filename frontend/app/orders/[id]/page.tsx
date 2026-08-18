import { OrderStatusClient } from "@/components/orders/OrderStatusClient";

// GitHub Pages statik eksporti uchun — dinamik route'lar uchun parametrlar.
// Eksport rejimida faqat shu id'lar uchun sahifa yaratiladi; boshqa id'lar
// backend mavjud bo'lganda (SSR/standalone) to'liq ishlaydi.
export function generateStaticParams() {
  return [{ id: "1" }, { id: "2" }, { id: "3" }];
}

export default function OrderStatusPage() {
  return <OrderStatusClient />;
}
