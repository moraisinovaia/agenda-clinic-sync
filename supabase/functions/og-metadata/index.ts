const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CRAWLER_PATTERNS = [
  "WhatsApp", "facebookexternalhit", "Twitterbot", "TelegramBot",
  "LinkedInBot", "Slackbot", "Discordbot", "Googlebot", "bingbot",
];

const PARTNERS: Record<string, { name: string; subtitle: string; icon: string }> = {
  "gt.inovaia": {
    name: "GT INOVA",
    subtitle: "Soluções Inovadoras",
    icon: "/gt-inova-icon-512.png",
  },
};

function isCrawler(ua: string): boolean {
  return CRAWLER_PATTERNS.some((p) => ua.includes(p));
}

function getPartner(domain: string) {
  for (const [pattern, data] of Object.entries(PARTNERS)) {
    if (domain.includes(pattern)) return data;
  }
  return { name: "INOVAIA", subtitle: "Sistema de Agendamentos Médicos", icon: "/icon-512.png" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const domain = url.searchParams.get("domain") || req.headers.get("host") || "";
  const userAgent = req.headers.get("user-agent") || "";
  const partner = getPartner(domain);
  const siteUrl = domain.startsWith("http") ? domain : `https://${domain}`;

  if (isCrawler(userAgent)) {
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta property="og:title" content="${partner.name} - ${partner.subtitle}"/>
<meta property="og:description" content="${partner.name} - ${partner.subtitle}"/>
<meta property="og:image" content="${siteUrl}${partner.icon}"/>
<meta property="og:type" content="website"/>
<meta property="og:url" content="${siteUrl}"/>
<meta name="twitter:card" content="summary"/>
<meta name="twitter:title" content="${partner.name} - ${partner.subtitle}"/>
<meta name="twitter:image" content="${siteUrl}${partner.icon}"/>
<title>${partner.name} - ${partner.subtitle}</title>
</head>
<body></body>
</html>`;
    return new Response(html, {
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: siteUrl },
  });
});
