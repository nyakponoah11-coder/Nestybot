export const NETWORK_LABEL: Record<string, string> = {
  MTN: "MTN",
  TELECEL: "Telecel",
  AT: "AirtelTigo",
};

export const NETWORK_ORDER = ["MTN", "TELECEL", "AT"] as const;

export const networkClass = (n: string) => {
  if (n === "MTN") return "bg-mtn text-mtn-foreground";
  if (n === "TELECEL") return "bg-telecel text-telecel-foreground";
  if (n === "AT") return "bg-at text-at-foreground";
  return "bg-muted text-foreground";
};

export const formatGHS = (n: number | string) =>
  `GH₵ ${Number(n).toFixed(2)}`;

export const validateGhanaPhone = (raw: string) => {
  const p = raw.replace(/\s+/g, "");
  return /^(0\d{9}|233\d{9})$/.test(p);
};

export interface ProductItem {
  id: string;
  network: string;
  capacity: string;
  mb: number;
  price: number;
  name: string | null;
  in_stock: boolean;
  sort_order: number;
}

export const DEFAULT_PRODUCTS: ProductItem[] = [
  // MTN NON-EXPIRY BUNDLES
  { id: "p-mtn-1", network: "MTN", capacity: "1", mb: 1024, price: 4.30, name: "MTN 1GB Data", in_stock: true, sort_order: 1 },
  { id: "p-mtn-2", network: "MTN", capacity: "2", mb: 2048, price: 8.90, name: "MTN 2GB Data", in_stock: true, sort_order: 2 },
  { id: "p-mtn-3", network: "MTN", capacity: "3", mb: 3072, price: 13.50, name: "MTN 3GB Data", in_stock: true, sort_order: 3 },
  { id: "p-mtn-4", network: "MTN", capacity: "4", mb: 4096, price: 18.00, name: "MTN 4GB Data", in_stock: true, sort_order: 4 },
  { id: "p-mtn-5", network: "MTN", capacity: "5", mb: 5120, price: 23.50, name: "MTN 5GB Data", in_stock: true, sort_order: 5 },
  { id: "p-mtn-6", network: "MTN", capacity: "6", mb: 6144, price: 26.50, name: "MTN 6GB Data", in_stock: true, sort_order: 6 },
  { id: "p-mtn-8", network: "MTN", capacity: "8", mb: 8192, price: 35.00, name: "MTN 8GB Data", in_stock: true, sort_order: 7 },
  { id: "p-mtn-10", network: "MTN", capacity: "10", mb: 10240, price: 44.50, name: "MTN 10GB Data", in_stock: true, sort_order: 8 },
  { id: "p-mtn-15", network: "MTN", capacity: "15", mb: 15360, price: 63.50, name: "MTN 15GB Data", in_stock: true, sort_order: 9 },
  { id: "p-mtn-20", network: "MTN", capacity: "20", mb: 20480, price: 83.50, name: "MTN 20GB Data", in_stock: true, sort_order: 10 },
  { id: "p-mtn-25", network: "MTN", capacity: "25", mb: 25600, price: 103.50, name: "MTN 25GB Data", in_stock: true, sort_order: 11 },
  { id: "p-mtn-30", network: "MTN", capacity: "30", mb: 30720, price: 121.60, name: "MTN 30GB Data", in_stock: true, sort_order: 12 },
  { id: "p-mtn-40", network: "MTN", capacity: "40", mb: 40960, price: 160.50, name: "MTN 40GB Data", in_stock: true, sort_order: 13 },
  { id: "p-mtn-50", network: "MTN", capacity: "50", mb: 51200, price: 206.50, name: "MTN 50GB Data", in_stock: true, sort_order: 14 },

  // TELECEL BUNDLES
  { id: "p-tel-10", network: "TELECEL", capacity: "10", mb: 10240, price: 38.50, name: "Telecel 10GB Data", in_stock: true, sort_order: 1 },
  { id: "p-tel-12", network: "TELECEL", capacity: "12", mb: 12288, price: 45.50, name: "Telecel 12GB Data", in_stock: true, sort_order: 2 },
  { id: "p-tel-15", network: "TELECEL", capacity: "15", mb: 15360, price: 56.40, name: "Telecel 15GB Data", in_stock: true, sort_order: 3 },
  { id: "p-tel-20", network: "TELECEL", capacity: "20", mb: 20480, price: 27.90, name: "Telecel 20GB Data", in_stock: true, sort_order: 4 },
  { id: "p-tel-25", network: "TELECEL", capacity: "25", mb: 25600, price: 100.50, name: "Telecel 25GB Data", in_stock: true, sort_order: 5 },
  { id: "p-tel-30", network: "TELECEL", capacity: "30", mb: 30720, price: 110.00, name: "Telecel 30GB Data", in_stock: true, sort_order: 6 },
  { id: "p-tel-35", network: "TELECEL", capacity: "35", mb: 35840, price: 133.40, name: "Telecel 35GB Data", in_stock: true, sort_order: 7 },
  { id: "p-tel-40", network: "TELECEL", capacity: "40", mb: 40960, price: 145.00, name: "Telecel 40GB Data", in_stock: true, sort_order: 8 },
  { id: "p-tel-45", network: "TELECEL", capacity: "45", mb: 46080, price: 160.80, name: "Telecel 45GB Data", in_stock: true, sort_order: 9 },
  { id: "p-tel-50", network: "TELECEL", capacity: "50", mb: 51200, price: 180.00, name: "Telecel 50GB Data", in_stock: true, sort_order: 10 },
  { id: "p-tel-100", network: "TELECEL", capacity: "100", mb: 102400, price: 400.75, name: "Telecel 100GB Data", in_stock: true, sort_order: 11 },

  // AT (AIRTELTIGO) BUNDLES
  { id: "p-at-1", network: "AT", capacity: "1", mb: 1024, price: 4.50, name: "AT 1GB Data", in_stock: true, sort_order: 1 },
  { id: "p-at-2", network: "AT", capacity: "2", mb: 2048, price: 11.00, name: "AT 2GB Data", in_stock: true, sort_order: 2 },
  { id: "p-at-3", network: "AT", capacity: "3", mb: 3072, price: 15.00, name: "AT 3GB Data", in_stock: true, sort_order: 3 },
  { id: "p-at-4", network: "AT", capacity: "4", mb: 4096, price: 18.00, name: "AT 4GB Data", in_stock: true, sort_order: 4 },
  { id: "p-at-5", network: "AT", capacity: "5", mb: 5120, price: 23.00, name: "AT 5GB Data", in_stock: true, sort_order: 5 },
  { id: "p-at-6", network: "AT", capacity: "6", mb: 6144, price: 27.00, name: "AT 6GB Data", in_stock: true, sort_order: 6 },
  { id: "p-at-8", network: "AT", capacity: "8", mb: 8192, price: 35.00, name: "AT 8GB Data", in_stock: true, sort_order: 7 },
  { id: "p-at-10", network: "AT", capacity: "10", mb: 10240, price: 44.00, name: "AT 10GB Data", in_stock: true, sort_order: 8 },
  { id: "p-at-15", network: "AT", capacity: "15", mb: 15360, price: 62.00, name: "AT 15GB Data", in_stock: true, sort_order: 9 },
  { id: "p-at-25", network: "AT", capacity: "25", mb: 25600, price: 106.00, name: "AT 25GB Data", in_stock: true, sort_order: 10 },
  { id: "p-at-30", network: "AT", capacity: "30", mb: 30720, price: 121.00, name: "AT 30GB Data", in_stock: true, sort_order: 11 },
];

