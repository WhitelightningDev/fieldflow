import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { Mail, MapPin, Phone } from "lucide-react";
import * as React from "react";
import { useSearchParams } from "react-router-dom";

export default function Contact() {
  const [searchParams] = useSearchParams();
  const [form, setForm] = React.useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    subject: "",
    message: "",
  });

  React.useEffect(() => {
    const subject = searchParams.get("subject") ?? "";
    const message = searchParams.get("message") ?? "";
    if (!subject && !message) return;
    setForm((p) => ({
      ...p,
      subject: p.subject || subject,
      message: p.message || message,
    }));
  }, [searchParams]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = (form.subject || "Contact request").trim();
    const lines = [
      `Name: ${form.name || "—"}`,
      `Email: ${form.email || "—"}`,
      `Company: ${form.company || "—"}`,
      `Phone: ${form.phone || "—"}`,
      "",
      (form.message || "").trim(),
    ];

    const body = encodeURIComponent(lines.join("\n"));
    const mailto = `mailto:support@yourcompany.co.za?subject=${encodeURIComponent(subject)}&body=${body}`;
    window.location.href = mailto;
    toast({ title: "Opening your email client", description: "If nothing happens, copy the message and email support manually." });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h1 className="text-3xl md:text-4xl font-bold mb-3">Contact</h1>
              <p className="text-muted-foreground text-lg">
                Sales, support, or onboarding — send us a message and we’ll get back to you.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="bg-card/70 backdrop-blur-sm lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Send a message</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={onSubmit} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Your name</Label>
                        <Input
                          value={form.name}
                          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                          placeholder="Jane Doe"
                          autoComplete="name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          value={form.email}
                          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                          placeholder="jane@example.com"
                          type="email"
                          autoComplete="email"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Company (optional)</Label>
                        <Input
                          value={form.company}
                          onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))}
                          placeholder="Acme Plumbing"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone (optional)</Label>
                        <Input
                          value={form.phone}
                          onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                          placeholder="+27 82 123 4567"
                          autoComplete="tel"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Subject</Label>
                      <Input
                        value={form.subject}
                        onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
                        placeholder="Support request / Demo / Billing question"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Message</Label>
                      <Textarea
                        value={form.message}
                        onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                        placeholder="Tell us what you need help with…"
                        rows={7}
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <Button type="submit" className="gradient-bg hover:opacity-90 shadow-glow">
                        Send
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="bg-card/70 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Contact details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4 mt-0.5" />
                      <div>
                        <div className="text-foreground font-medium">systems.devconone@gmail.com</div>
                        <div>We usually reply within 1 business day.</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4 mt-0.5" />
                      <div>
                        <div className="text-foreground font-medium">+27 74 658 8885</div>
                        <div>Mon–Fri, 08:00–17:00</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4 mt-0.5" />
                      <div>
                        <div className="text-foreground font-medium">South Africa</div>
                        <div>Remote-first team</div>
                      </div>
                    </div>
                   
                  </CardContent>
                </Card>

                <Card className="bg-card/70 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Need a demo?</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-3">
                    <div>
                      Tell us your trade (e.g. plumbing), team size, and what you want to improve (dispatch, compliance, billing, inventory).
                    </div>
                    <Button asChild variant="outline" className="w-full">
                      <a href="mailto:systems.devconone@gmail.com?subject=Demo%20request">Email sales</a>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
