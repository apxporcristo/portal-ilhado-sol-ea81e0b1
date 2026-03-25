import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function isValidIP(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  return parts.length === 4 && parts.every(p => !isNaN(p) && p >= 0 && p <= 255);
}

function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

const MAX_DATA_SIZE = 1024 * 1024; // 1MB

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ip, port, data, test } = await req.json();

    if (!ip || !port) {
      return new Response(
        JSON.stringify({ error: "IP e porta são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (typeof ip !== 'string' || !isValidIP(ip)) {
      return new Response(
        JSON.stringify({ error: "Endereço IP inválido" }),
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

    // Build the raw bytes to send
    let rawData: Uint8Array;
    if (test) {
      const encoder = new TextEncoder();
      rawData = new Uint8Array([
        0x1B, 0x40,
        0x1B, 0x61, 0x01,
        0x1B, 0x45, 0x01,
        ...encoder.encode("TESTE DE IMPRESSAO"),
        0x0A,
        0x1B, 0x45, 0x00,
        ...encoder.encode("Comunicacao OK!"),
        0x0A,
        ...encoder.encode(new Date().toLocaleString("pt-BR")),
        0x0A,
        0x1B, 0x64, 0x04,
        0x1D, 0x56, 0x00,
      ]);
    } else if (data) {
      if (!Array.isArray(data) || data.length > MAX_DATA_SIZE) {
        return new Response(
          JSON.stringify({ error: "Dados inválidos ou excedem o tamanho máximo (1MB)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!data.every((b: unknown) => typeof b === 'number' && b >= 0 && b <= 255)) {
        return new Response(
          JSON.stringify({ error: "Dados devem ser um array de bytes (0-255)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      rawData = new Uint8Array(data);
    } else {
      return new Response(
        JSON.stringify({ error: "Envie 'data' (array de bytes) ou 'test': true" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Connect with 10-second timeout
    const conn = await Promise.race([
      Deno.connect({ hostname: ip, port: portNum }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 10000)
      ),
    ]);
    
    try {
      await conn.write(rawData);
      await new Promise((r) => setTimeout(r, 500));
    } finally {
      conn.close();
    }

    return new Response(
      JSON.stringify({ success: true, message: "Dados enviados para a impressora" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro ao imprimir:", error);
    
    const errMsg = (error as Error).message || '';
    const message = error instanceof Deno.errors.ConnectionRefused
      ? "Conexão recusada. Verifique se a impressora está ligada e acessível na rede."
      : (error instanceof Deno.errors.TimedOut || errMsg === 'TIMEOUT')
      ? "Falha de comunicação: impressora não encontrada após 10 segundos. Verifique o IP, porta e se a impressora está conectada na mesma rede."
      : `Falha de comunicação com a impressora: ${errMsg}`;

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
