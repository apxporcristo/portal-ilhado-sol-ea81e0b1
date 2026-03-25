import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function isValidSubnet(subnet: string): boolean {
  const parts = subnet.split('.').map(Number);
  return parts.length === 3 && parts.every(p => !isNaN(p) && p >= 0 && p <= 255);
}

function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subnet, port = 9100, timeout = 1000 } = await req.json();

    if (!subnet || typeof subnet !== 'string') {
      return new Response(
        JSON.stringify({ error: "Informe a sub-rede (ex: 192.168.1)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!isValidSubnet(subnet)) {
      return new Response(
        JSON.stringify({ error: "Formato de sub-rede inválido (ex: 192.168.1)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const portNum = parseInt(String(port), 10);
    if (!isValidPort(portNum)) {
      return new Response(
        JSON.stringify({ error: "Porta inválida (1-65535)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const timeoutMs = Math.min(parseInt(String(timeout), 10), 3000);

    const found: { ip: string; port: number; mac?: string; hostname?: string }[] = [];

    const batchSize = 30;
    for (let start = 1; start <= 254; start += batchSize) {
      const promises: Promise<void>[] = [];
      for (let i = start; i < Math.min(start + batchSize, 255); i++) {
        const ip = `${subnet}.${i}`;
        promises.push(
          (async () => {
            try {
              const conn = await Promise.race([
                Deno.connect({ hostname: ip, port: portNum }),
                new Promise<never>((_, reject) =>
                  setTimeout(() => reject(new Error("timeout")), timeoutMs)
                ),
              ]);
              
              // Try to get hostname via reverse DNS
              let hostname: string | undefined;
              try {
                const result = await Deno.resolveDns(ip.split('.').reverse().join('.') + '.in-addr.arpa', 'PTR');
                if (result?.length > 0) hostname = result[0];
              } catch { /* ignore */ }

              found.push({ ip, port: portNum, hostname });
              try { (conn as Deno.Conn).close(); } catch { /* ignore */ }
            } catch {
              // no printer
            }
          })()
        );
      }
      await Promise.all(promises);
    }

    return new Response(
      JSON.stringify({ success: true, printers: found }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro ao escanear:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao escanear a rede." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
