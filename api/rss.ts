import { NextResponse } from 'next/server';

export const revalidate = 3600;
export const runtime = 'edge';

interface RSSItem {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  contentSnippet: string;
  excerpt: string;
  tags: string[];
  source: string;
  date: string;
  author: string;
  category?: string;
  resources?: {
    name: string;
    type: string;
    url: string;
  }[];
}

const FEED_URLS = [
  {
    url: 'https://bofip.impots.gouv.fr/bofip/ext/rss.xml?actualites=1&publications=1&series=IR-CHAMP:IR-BASE:IR-LIQ:IR-RICI:IR-DECLA:IR-PAS:IR-PAIE:IR-PROCD:IR-CESS:IR-DOMIC:IR-CHR:RSA-CHAMP:RSA-GEO:RSA-BASE:RSA-PENS:RSA-ES:RSA-GER:RPPM-PVBMC:RPPM-RCM:RPPM-PVBMI:RFPI-CHAMP:RFPI-BASE:RFPI-DECLA:RFPI-SPEC:RFPI-PROCD:RFPI-CTRL:RFPI-PVI:RFPI-PVINR:RFPI-SPI:RFPI-TDC:RFPI-TPVIE:BA-CHAMP:BA-REG:BA-BASE:BA-LIQ:BA-RICI:BA-DECLA:BA-PROCD:BA-SECT:BA-CESS:BNC-CHAMP:BNC-BASE:BNC-RICI:BNC-DECLA:BNC-PROCD:BNC-SECT:BNC-CESS:BIC-CHAMP:BIC-BASE:BIC-PDSTK:BIC-CHG:BIC-PVMV:BIC-AMT:BIC-PROV:BIC-DEF:BIC-RICI:BIC-DECLA:BIC-PROCD:BIC-CESS:BIC-PTP:IS-CHAMP:IS-BASE:IS-DEF:IS-LIQ:IS-RICI:IS-DECLA:IS-AUT:IS-PROCD:IS-GEO:IS-CESS:IS-FUS:IS-GPE:TVA-CHAMP:TVA-BASE:TVA-LIQ:TVA-DED:TVA-DECLA:TVA-PROCD:TVA-GEO:TVA-SECT:TVA-IMM:TVA-AU:TCA-TSN:TCA-OCE:TCA-CDP:TCA-CAEA:TCA-RSAB:TCA-RSD:TCA-PPA:TCA-TPA:TCA-CSR:TCA-AHJ:TCA-RSP:TCA-PJP:TCA-PJC:TCA-TPC:TCA-BNA:TCA-AUTO:TCA-RPE:TCA-FIN:TCA-POLL:CVAE-CHAMP:CVAE-BASE:CVAE-LIQ:CVAE-LIEU:CVAE-DECLA:CVAE-PROCD:TPS-TS:TPS-PEEC:TPS-EMOE:TPS-THR:TFP-CAP:TFP-IFER:TFP-MINES:TFP-GUF:TFP-PYL:TFP-TEM:TFP-TSC:TFP-TASC:TFP-ASSUR:TFP-TFSCT:TFP-TEH:AIS-MOB:AIS-CCN:IF-COLOC:IF-TFNB:IF-TFB:IF-TH:IF-CFE:IF-AUT:PAT-IFI:PAT-ISF:PAT-TPC:PAT-CAP:ENR-DG:ENR-DMTOI:ENR-DMTOM:ENR-JOMI:ENR-DMTG:ENR-PTG:ENR-AVS:ENR-TIM:TCAS-ASSUR:TCAS-AUT:REC-PART:REC-PRO:REC-PREA:REC-GAR:REC-FORCE:REC-SOLID:REC-EVTS:DAE-10:DAE-20:CF-DG:CF-CPF:CF-COM:CF-IOR:CF-PGR:CF-CMSS:CF-INF:CTX-DG:CTX-PREA:CTX-ADM:CTX-JUD:CTX-DRO:CTX-REP:CTX-RDI:CTX-GCX:CTX-DRS:CTX-BF:SJ-AGR:SJ-RES:INT-DG:INT-AEA:INT-CVB:CAD-TOPO:CAD-REM:CAD-AFR:CAD-MAJ:CAD-INFO:CAD-DIFF:DJC-COVID19:DJC-CADA:DJC-FIN:DJC-OA:DJC-EXPC:DJC-TDC:DJC-TRUST:DJC-SECR:DJC-ARF:DJC-DES:BAREME-000000:FORM-000000:LETTRE-000000:CARTE-000000:ANNX-000000&maxR=10&maxJ=14',
    source: 'BOFiP'
  },
  {
    url: 'https://boss.gouv.fr/portail/fil-rss-boss-rescrit/pagecontent/flux-actualites.rss',
    source: 'BOSS'
  }
];

async function fetchFeedContent(url: string) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(url, {
      signal: controller.signal,
      // Removed 'next' property as it is not valid in 'RequestInit'
    });

    clearTimeout(timeout);

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.text();
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return null;
  }
}

function parseRssContent(xmlString: string, source: string): RSSItem[] {
  const items: RSSItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  
  let match;
  while ((match = itemRegex.exec(xmlString)) !== null) {
    const itemContent = match[1];
    const titleMatch = /<title>([\s\S]*?)<\/title>/.exec(itemContent);
    const linkMatch = /<link>([\s\S]*?)<\/link>/.exec(itemContent);
    const pubDateMatch = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(itemContent);
    const descMatch = /<description>([\s\S]*?)<\/description>/.exec(itemContent);

    items.push({
      id: `rss-${items.length}`,
      title: titleMatch?.[1]?.trim() || 'Sans titre',
      link: linkMatch?.[1]?.trim() || '#',
      pubDate: pubDateMatch?.[1]?.trim() || new Date().toISOString(),
      contentSnippet: (descMatch?.[1]?.replace(/<[^>]*>?/gm, '')?.substring(0, 200) + '...'),
      source,
      author: source, // Utilisez source comme auteur par défaut
      date: new Date(pubDateMatch?.[1] || Date.now()).toLocaleDateString('fr-FR'),
      excerpt: (descMatch?.[1]?.replace(/<[^>]*>?/gm, '')?.substring(0, 200) + '...'),
      tags: ['Fiscal', 'Officiel'],
      resources: [] // Tableau vide par défaut
    });
  }

  return items;
}

export async function GET() {
  try {
    const feedPromises = FEED_URLS.map(async (feed) => {
      const content = await fetchFeedContent(feed.url);
      return content ? parseRssContent(content, feed.source) : [];
    });

    const results = await Promise.all(feedPromises);
    const allItems = results.flat().sort((a, b) => 
      new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
    );

    return new Response(JSON.stringify(allItems.slice(0, 8)), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=1800'
      }
    });
  } catch (error) {
    console.error('Error processing feeds:', error);
    
    return new Response(JSON.stringify([{
      id: 'error-fallback',
      title: 'Service temporairement indisponible',
      contentSnippet: 'Les actualités ne sont pas disponibles pour le moment. Veuillez réessayer plus tard.',
      source: 'Système',
      author: 'Administrateur',
      date: new Date().toLocaleDateString('fr-FR'),
      excerpt: 'Les flux RSS ne sont pas disponibles pour le moment.',
      tags: ['Erreur'],
      resources: []
    }]), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}