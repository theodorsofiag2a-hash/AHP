import { Mail } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { contactMailto } from "@/lib/contact";

export function ContactG2a({
  subject,
  organizationSlug,
  label = "Falar com a G2A",
  size = "md",
}: {
  subject: string;
  organizationSlug?: string;
  label?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <a href={contactMailto(subject, organizationSlug)} className={buttonClasses("primary", size)}>
      <Mail className="h-4 w-4" />
      {label}
    </a>
  );
}
