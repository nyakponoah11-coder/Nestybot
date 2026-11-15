import { Phone } from "lucide-react";

const digitsOnly = (value: string) => value.replace(/\D/g, "");

export const phoneHref = (value: string) => {
  const digits = digitsOnly(value);
  if (!digits) return "";
  return `tel:+${digits.startsWith("233") ? digits : digits.startsWith("0") ? `233${digits.slice(1)}` : digits}`;
};

export const PhoneLink = ({ value, compact = false }: { value: string | null | undefined; compact?: boolean }) => {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const href = phoneHref(value);
  return (
    <a href={href} className="inline-flex items-center gap-1 font-mono hover:underline" title={`Call ${value}`}>
      {!compact && <Phone className="size-3.5 text-muted-foreground" />}
      {value}
    </a>
  );
};

export default PhoneLink;