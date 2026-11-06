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
  const cleanPhone = phone.replace(/\D/g, "");
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}

export function buildUpiIntentLink({
  upiId,
  name,
  amount,
  orderNumber,
}: {
  upiId: string;
  name: string;
  amount: number;
  orderNumber: string;
}): string {
  const cleanName = encodeURIComponent(name);
  const note = encodeURIComponent(`Advance Token for Order ${orderNumber}`);
  return `upi://pay?pa=${upiId}&pn=${cleanName}&am=${amount}&cu=INR&tn=${note}`;
}

