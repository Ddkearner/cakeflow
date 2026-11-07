import { jsPDF } from "jspdf";
import { Order, Baker } from "./types";

export function generateReceiptPdf(order: Order, baker: Baker) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const margin = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 25;

  // Header: Brand / Baker
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(24, 24, 27);
  doc.text(baker.name || "Cake Studio", margin, y);

  // Status Badge on Right
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(5, 150, 105);
  const badgeText = "ADVANCE TOKEN PAID [OK]";
  const badgeWidth = doc.getTextWidth(badgeText);
  doc.text(badgeText, pageWidth - margin - badgeWidth, y);

  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(113, 113, 122);
  doc.text(`Booking Token Receipt - ${new Date().toLocaleDateString("en-IN")}`, margin, y);

  y += 4;
  doc.setDrawColor(228, 228, 231);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);

  // Order Info Box
  y += 8;
  doc.setFillColor(244, 244, 245);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 26, 3, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(24, 24, 27);
  doc.text(`Order #${order.order_number}`, margin + 5, y + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(113, 113, 122);
  doc.text("Ready Date & Time:", margin + 5, y + 14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(24, 24, 27);
  doc.text(`${order.delivery_date} (${order.time_slot})`, margin + 40, y + 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(113, 113, 122);
  doc.text("Fulfilment Mode:", margin + 5, y + 21);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(24, 24, 27);
  doc.text(order.fulfilment_type === "delivery" ? "Home Delivery" : "Self Pickup", margin + 40, y + 21);

  // Cake Specifications Section
  y += 34;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(24, 24, 27);
  doc.text("CAKE SPECIFICATIONS", margin, y);

  y += 3;
  doc.line(margin, y, pageWidth - margin, y);

  y += 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`${order.weight} ${order.flavour}`, margin, y);

  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(113, 113, 122);
  doc.text(`Dietary: ${order.is_eggless ? "100% Eggless" : "With Egg"}`, margin, y);

  if (order.cake_message && order.cake_message.trim() && order.cake_message.trim().toLowerCase() !== "none") {
    y += 6;
    doc.text(`Message on Cake: "${order.cake_message.trim()}"`, margin, y);
  }

  if (order.special_notes && order.special_notes.trim()) {
    y += 6;
    doc.text(`Notes: ${order.special_notes.trim()}`, margin, y);
  }

  // Customer / Address Section
  y += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(24, 24, 27);
  doc.text("CUSTOMER & LOCATION", margin, y);

  y += 3;
  doc.line(margin, y, pageWidth - margin, y);

  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(113, 113, 122);
  doc.text("Customer Name:", margin, y);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(24, 24, 27);
  doc.text(`${order.customer_name || "Customer"}${order.customer_phone ? ` (${order.customer_phone})` : ""}`, margin + 35, y);

  if (order.delivery_address || baker.pickup_address) {
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(113, 113, 122);
    doc.text(order.fulfilment_type === "delivery" ? "Delivery Address:" : "Pickup Studio:", margin, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(24, 24, 27);
    const addr = order.fulfilment_type === "delivery" ? (order.delivery_address || "") : (baker.pickup_address || "");
    doc.text(addr, margin + 35, y, { maxWidth: pageWidth - margin - 45 });
  }

  // Payment Breakdown Table
  y += 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(24, 24, 27);
  doc.text("PAYMENT BREAKDOWN", margin, y);

  y += 3;
  doc.line(margin, y, pageWidth - margin, y);

  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(24, 24, 27);
  doc.text("Total Cake Value", margin, y);
  doc.setFont("helvetica", "bold");
  const totalValText = `Rs. ${order.total_price}`;
  doc.text(totalValText, pageWidth - margin - doc.getTextWidth(totalValText), y);

  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(5, 150, 105);
  doc.text("Advance Token Paid (Direct UPI)", margin, y);
  doc.setFont("helvetica", "bold");
  const tokenValText = `- Rs. ${order.token_amount}`;
  doc.text(tokenValText, pageWidth - margin - doc.getTextWidth(tokenValText), y);

  y += 4;
  doc.line(margin, y, pageWidth - margin, y);

  y += 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(24, 24, 27);
  doc.text("Balance Due at Handover", margin, y);
  const balValText = `Rs. ${order.balance_amount}`;
  doc.text(balValText, pageWidth - margin - doc.getTextWidth(balValText), y);

  // Footer
  y = doc.internal.pageSize.getHeight() - 15;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(161, 161, 170);
  doc.text(
    `100% To Baker - Zero Middleman Commission - CakeFlow`,
    pageWidth / 2,
    y,
    { align: "center" }
  );

  // Download directly on phone
  const cleanOrderNum = order.order_number.replace(/[^a-zA-Z0-9_-]/g, "");
  doc.save(`CakeFlow_Receipt_${cleanOrderNum}.pdf`);
}
