import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invalidateShopCache } from "@/lib/storeCache";
import { getCacheMeta, setCache, invalidateCache } from "@/lib/localCache";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NETWORK_ORDER, NETWORK_LABEL, networkClass } from "@/lib/networks";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Product {
  id: string; network: string; capacity: string; mb: number;
  price: number; name: string | null; in_stock: boolean; sort_order: number;
}

const AdminProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const adminData = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("admin-data", { body });
    if (error || data?.error) throw new Error(data?.error || error?.message || "Admin request failed");
    return data;
  };

  const load = async (force = false) => {
    if (!force) {
      const cached = getCacheMeta<Product[]>("admin_products_cache");
      if (cached.exists && cached.data) {
        setProducts(cached.data);
        setLoading(false);
        if (!cached.isStale) return;
      }
    }

    try {
      const data = await adminData({ action: "listProducts" });
      if (Array.isArray(data?.products)) {
        setProducts(data.products);
        setCache("admin_products_cache", data.products, 5 * 60 * 1000);
        setLoading(false);
        return;
      }
    } catch (_) {
      // Fallback: load directly from products table
    }

    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, network, capacity, mb, price, name, in_stock, sort_order")
        .order("sort_order");
      if (error) throw error;
      const list = (data as any) || [];
      setProducts(list);
      setCache("admin_products_cache", list, 5 * 60 * 1000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load products");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { document.title = "Admin · Products"; load(false); }, []);

  const updateField = (id: string, field: keyof Product, value: any) => {
    setProducts(ps => ps.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const save = async (p: Product) => {
    setSavingId(p.id);
    let success = false;
    let errMessage = "";

    // 1. Try edge function
    try {
      await adminData({
        action: "updateProduct",
        product: { id: p.id, price: Number(p.price), name: p.name, in_stock: p.in_stock, sort_order: Number(p.sort_order) },
      });
      success = true;
    } catch (e: any) {
      errMessage = e?.message || "";
    }

    // 2. Direct database update fallback
    if (!success) {
      try {
        const { error: dbErr } = await supabase
          .from("products")
          .update({
            price: Number(p.price),
            name: p.name,
            in_stock: p.in_stock,
            sort_order: Number(p.sort_order),
          })
          .eq("id", p.id);
        if (!dbErr) {
          success = true;
        } else {
          errMessage = dbErr.message;
        }
      } catch (dbEx: any) {
        errMessage = dbEx?.message || errMessage;
      }
    }

    setSavingId(null);
    if (!success) {
      toast.error(errMessage || "Could not update product");
    } else {
      invalidateCache("admin_products_cache");
      invalidateShopCache();
      toast.success(`${NETWORK_LABEL[p.network]} ${p.capacity}GB updated`);
    }
  };

  const remove = async (p: Product) => {
    if (!confirm(`Delete ${NETWORK_LABEL[p.network]} ${p.capacity}GB?`)) return;
    let deleted = false;
    try {
      await adminData({ action: "deleteProduct", id: p.id });
      deleted = true;
    } catch (_) {}

    if (!deleted) {
      try {
        const { error } = await supabase.from("products").delete().eq("id", p.id);
        if (!error) deleted = true;
      } catch (_) {}
    }

    if (deleted) {
      invalidateCache("admin_products_cache");
      invalidateShopCache();
      toast.success("Deleted");
      load(true);
    } else {
      toast.error("Could not delete product");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-black">Products</h1>
        <AddProductDialog onCreated={load} />
      </div>

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin" /></div>
      ) : (
        <Tabs defaultValue="MTN">
          <TabsList className="grid grid-cols-3 w-full md:w-auto">
            {NETWORK_ORDER.map(n => <TabsTrigger key={n} value={n}>{NETWORK_LABEL[n]}</TabsTrigger>)}
          </TabsList>
          {NETWORK_ORDER.map(n => (
            <TabsContent key={n} value={n} className="space-y-2 mt-4">
              {products.filter(p => p.network === n).length === 0 && (
                <p className="text-muted-foreground text-sm">No products. Click "Add product".</p>
              )}
              {products.filter(p => p.network === n).map(p => (
                <Card key={p.id} className="p-3 md:p-4 flex flex-wrap md:flex-nowrap items-center gap-3 bg-gradient-card">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${networkClass(p.network)}`}>
                    {p.capacity}GB
                  </span>
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2 min-w-0">
                    <div>
                      <Label className="text-xs">Price (GH₵)</Label>
                      <Input type="number" step="0.01" value={p.price} onChange={e => updateField(p.id, "price", e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Sort</Label>
                      <Input type="number" value={p.sort_order} onChange={e => updateField(p.id, "sort_order", Number(e.target.value))} />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Label (optional)</Label>
                      <Input value={p.name || ""} onChange={e => updateField(p.id, "name", e.target.value)} placeholder="Non-expiry" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Switch checked={p.in_stock} onCheckedChange={v => updateField(p.id, "in_stock", v)} />
                      <span>{p.in_stock ? "In stock" : "Hidden"}</span>
                    </div>
                    <Button size="sm" onClick={() => save(p)} disabled={savingId === p.id} className="bg-gradient-gold text-accent-foreground hover:opacity-90">
                      {savingId === p.id ? <Loader2 className="size-4 animate-spin" /> : "Save"}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(p)}><Trash2 className="size-4" /></Button>
                  </div>
                </Card>
              ))}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
};

const AddProductDialog = ({ onCreated }: { onCreated: () => void }) => {
  const [open, setOpen] = useState(false);
  const [network, setNetwork] = useState("MTN");
  const [capacity, setCapacity] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const cap = capacity.trim();
    const pr = Number(price);
    if (!cap || !pr || isNaN(pr)) { toast.error("Capacity and price required"); return; }
    setSaving(true);
    let success = false;
    let errMessage = "";

    // 1. Try edge function
    try {
      const { data, error } = await supabase.functions.invoke("admin-data", {
        body: { action: "createProduct", product: { network, capacity: cap, price: pr } },
      });
      if (!error && !data?.error) {
        success = true;
      } else {
        errMessage = data?.error || error?.message || "";
      }
    } catch (e: any) {
      errMessage = e?.message || "";
    }

    // 2. Direct database insert fallback
    if (!success) {
      try {
        const mb = Math.round(Number(cap) * 1000);
        const { error: dbErr } = await supabase.from("products").insert({
          network,
          capacity: cap,
          mb,
          price: pr,
          in_stock: true,
          sort_order: Number(cap) || 0,
        });
        if (!dbErr) {
          success = true;
        } else {
          errMessage = dbErr.message;
        }
      } catch (dbEx: any) {
        errMessage = dbEx?.message || errMessage;
      }
    }

    setSaving(false);
    if (!success) {
      toast.error(errMessage || "Could not add product");
      return;
    }
    invalidateCache("admin_products_cache");
    invalidateShopCache();
    toast.success("Added");
    setOpen(false);
    setCapacity("");
    setPrice("");
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-gold text-accent-foreground hover:opacity-90"><Plus className="size-4 mr-1" /> Add product</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New data bundle</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Network</Label>
            <Select value={network} onValueChange={setNetwork}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {NETWORK_ORDER.map(n => <SelectItem key={n} value={n}>{NETWORK_LABEL[n]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Capacity (GB)</Label>
            <Input value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="e.g. 5" />
            <p className="text-xs text-muted-foreground mt-1">Must match what your data API supports.</p>
          </div>
          <div>
            <Label>Customer price (GH₵)</Label>
            <Input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. 23.00" />
          </div>
          <Button onClick={submit} disabled={saving} className="w-full bg-gradient-gold text-accent-foreground hover:opacity-90">
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminProducts;
