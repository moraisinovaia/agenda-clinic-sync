import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CRAWLER_PATTERNS = [
  "WhatsApp",
  "facebookexternalhit",
  "Twitterbot",
  "TelegramBot",
  "LinkedInBot",
  "Slackbot",
  "Discordbot",
  "Googlebot",
  "bingbot",
];

function isCrawler(userAgent: string): boolean {
  return CRAWLER_PATTERNS.some((p) => userAgent.includes(p));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const domain = url.searchParams.get("domain") || req.headers.get("host") || "";
    const userAgent = req.headers.get("user-agent") || "";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch partner branding
    const { data: partners } = await supabase
      .from("partner_branding")
      .select("partner_name, domain_pattern, logo_url, subtitle");

    let partner = null;
    if (partners && partners.length > 0) {
      const matches = partners.filter((p: any) => domain.includes(p.domain_pattern));
      partner = matches.sort((a: any, b: any) => b.domain_pattern.length - a.domain_pattern.length)[0];
    }

    const name = partner?.partner_name || "INOVAIA";
    const subtitle = partner?.subtitle || "Sistema de Agendamentos Médicos";
    const siteUrl = domain.startsWith("http") ? domain : `https://${domain}`;
    const imageUrl = name === "GT INOVA"
      ? `${siteUrl}/gt-inova-icon-512.png`
      : `${siteUrl}/icon-512.png`;

    // If crawler, return static HTML with OG tags
    if (isCrawler(userAgent)) {
      const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta property="og:title" content="${name} - ${subtitle}" />
  <meta property="og:description" content="${name} - ${subtitle}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${siteUrl}" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${name} - ${subtitle}" />
  <meta name="twitter:description" content="${name} - ${subtitle}" />
  <meta name="twitter:image" content="${imageUrl}" />
  <title>${name} - ${subtitle}</title>
</head>
<body></body>
</html>`;

      return new Response(html, {
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Regular user: redirect to the site
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: siteUrl },
    });
  } catch (error) {
    console.error("og-metadata error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
