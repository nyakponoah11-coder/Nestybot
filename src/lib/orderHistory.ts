export interface SavedOrder {
  reference: string;
  recipient_phone: string;
  network?: string;
  capacity?: string;
  mb?: number;
  amount?: number | string;
  payment_status?: string;
  delivery_status?: string;
  datamart_reference?: string | null;
  error_message?: string | null;
  type?: "data" | "checker" | "service";
  created_at?: string;
  is_flash_sale?: boolean;
  notes?: string;
}

const ORDERS_KEY = "dataease_saved_orders";
const PHONE_KEY = "dataease_customer_phone";

export function getSavedPhone(): string {
  try {
    return localStorage.getItem(PHONE_KEY) || "";
  } catch {
    return "";
  }
}

export function saveCustomerPhone(phone: string): void {
  try {
    if (phone && phone.trim()) {
      localStorage.setItem(PHONE_KEY, phone.trim());
    }
  } catch {}
}

export function getSavedOrders(): SavedOrder[] {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveOrderToHistory(order: SavedOrder): void {
  try {
    if (!order.reference) return;
    const existing = getSavedOrders();
    const filtered = existing.filter((o) => o.reference !== order.reference);
    const updated = [
      {
        ...order,
        created_at: order.created_at || new Date().toISOString(),
      },
      ...filtered,
    ].slice(0, 50);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(updated));
    if (order.recipient_phone) {
      saveCustomerPhone(order.recipient_phone);
    }
    window.dispatchEvent(new CustomEvent("order-history-updated"));
  } catch {}
}

export function updateOrderInHistory(reference: string, patch: Partial<SavedOrder>): void {
  try {
    if (!reference) return;
    const existing = getSavedOrders();
    const idx = existing.findIndex((o) => o.reference === reference);
    if (idx !== -1) {
      existing[idx] = { ...existing[idx], ...patch };
      localStorage.setItem(ORDERS_KEY, JSON.stringify(existing));
    } else if (patch.recipient_phone) {
      saveOrderToHistory({ reference, recipient_phone: patch.recipient_phone, ...patch });
    }
    window.dispatchEvent(new CustomEvent("order-history-updated"));
  } catch {}
}
