import type { Metadata } from "next";
import { ContactForm } from "./ContactForm";
import { getServerTranslations } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerTranslations();
  return {
    title: t.meta.contactTitle,
    description: t.meta.contactDescription,
  };
}

export default async function ContactPage() {
  const t = await getServerTranslations();

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {t.contact.title}
        </h1>
        <p className="mt-3 text-muted-foreground">{t.contact.desc}</p>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <ContactForm />
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t.contact.orEmail}{" "}
        <a
          href="mailto:support@nandzz.com"
          className="text-violet-600 hover:underline"
        >
          support@nandzz.com
        </a>
      </p>
    </div>
  );
}
