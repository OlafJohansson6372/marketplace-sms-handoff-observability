export type BuyerUpdate = {
  orderId: string;
  buyerPhone: string;
  sellerName: string;
  assetName: string;
  handoffState: "ready" | "shipped";
};

export function shouldNotifyBuyer(update: BuyerUpdate): boolean {
  return update.handoffState === "ready";
}

export function buyerText(update: BuyerUpdate): string {
  return `${update.sellerName} has handed off ${update.assetName} for order ${update.orderId}.`;
}

export function handoffKey(orderId: string): string {
  return `marketplace-handoff-${orderId}`;
}
