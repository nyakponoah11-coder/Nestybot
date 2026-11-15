import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

const NUMBERS = ["233243682726", "233547100951"];

export const AfaWhatsAppPrompt = ({ phone, reference }: { phone: string; reference: string }) => {
  const message = encodeURIComponent(
    `Hello, I just paid for AFA registration.\n\nMy phone: ${phone}\nPayment reference: ${reference}\n\nPlease help me complete my registration.`
  );
  return (
    <Card className="p-5 mt-4 bg-gradient-to-br from-emerald-500 via-emerald-700 to-teal-900 text-white border-0 text-left">
      <div className="flex items-center gap-2">
        <MessageCircle className="size-5" />
        <div className="font-bold">Finish your AFA registration on WhatsApp</div>
      </div>
      <p className="text-sm opacity-90 mt-1">
        Send your details to one of our AFA agents. Tap a number to open WhatsApp with your info pre-filled.
      </p>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {NUMBERS.map(n => (
          <Button key={n} asChild className="bg-white text-emerald-800 hover:bg-emerald-50 font-bold">
            <a href={`https://wa.me/${n}?text=${message}`} target="_blank" rel="noreferrer">
              <MessageCircle className="size-4 mr-2" /> {n.replace("233", "0")}
            </a>
          </Button>
        ))}
      </div>
    </Card>
  );
};
