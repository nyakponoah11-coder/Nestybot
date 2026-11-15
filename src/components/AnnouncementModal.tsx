import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Megaphone } from "lucide-react";

interface Props {
  enabled: boolean;
  title?: string;
  message?: string;
}

// Show once per session per message content
export const AnnouncementModal = ({ enabled, title, message }: Props) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled || !message?.trim()) return;
    const key = "announcement_seen_v1";
    const sig = `${title || ""}::${message || ""}`;
    const seen = sessionStorage.getItem(key);
    if (seen !== sig) {
      const t = setTimeout(() => setOpen(true), 400);
      return () => clearTimeout(t);
    }
  }, [enabled, title, message]);

  const close = () => {
    setOpen(false);
    sessionStorage.setItem("announcement_seen_v1", `${title || ""}::${message || ""}`);
  };

  if (!enabled || !message?.trim()) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto size-14 rounded-full bg-gradient-gold grid place-items-center mb-2">
            <Megaphone className="size-7 text-accent-foreground" />
          </div>
          <DialogTitle className="text-center text-2xl font-black">
            {title?.trim() || "Announcement"}
          </DialogTitle>
          <DialogDescription className="text-center text-base text-foreground/80 whitespace-pre-wrap pt-2">
            {message}
          </DialogDescription>
        </DialogHeader>
        <Button onClick={close} className="bg-gradient-gold text-accent-foreground hover:opacity-90 w-full">
          Got it
        </Button>
      </DialogContent>
    </Dialog>
  );
};
