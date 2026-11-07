import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function generateOrderNumber(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "CK-";
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function generateSecretToken(slug: string): string {
  return `${slug}_${Math.random().toString(36).substring(2, 9)}`;
}

export function buildWhatsAppLink(phone: string, text: string): string {
  // Strip non-digits
  let cleanPhone = phone.replace(/\D/g, "");
  if (cleanPhone.length === 10) {
    cleanPhone = `91${cleanPhone}`;
  }
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}

export function buildUpiIntentLink({
  upiId,
  name,
  amount,
  orderNumber,
  txnRef,
  app = "universal",
}: {
  upiId: string;
  name: string;
  amount: number;
  orderNumber: string;
  txnRef?: string;
  app?: "universal" | "gpay" | "phonepe" | "paytm";
}): string {
  const cleanName = encodeURIComponent(name);
  const ref = txnRef || `CF${orderNumber.replace(/[^A-Za-z0-9]/g, "")}`;
  // NPCI standard: alphanumeric + spaces only, max 50 chars, zero special symbols/colons
  const note = encodeURIComponent(`CakeFlow Token ${orderNumber.replace(/[^A-Za-z0-9]/g, "")}`);
  const query = `pa=${encodeURIComponent(upiId)}&pn=${cleanName}&am=${amount}&cu=INR&tn=${note}&tr=${encodeURIComponent(ref)}`;

  if (app === "gpay") {
    return `tez://upi/pay?${query}`;
  }
  if (app === "phonepe") {
    return `phonepe://upi/pay?${query}`;
  }
  if (app === "paytm") {
    return `paytmmp://upi/pay?${query}`;
  }
  return `upi://pay?${query}`;
}

