import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + ':' + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL");
    const externalServiceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");

    if (!externalUrl || !externalServiceKey) {
      return jsonResponse({ error: "Configuração do Supabase externo ausente." }, 500);
    }

    const body = await req.json();
    const { caller_user_id, nome, email, password, cpf, acesso_voucher, tempo_voucher, cadastrar_produto, ficha_consumo, acesso_comanda, administrador } = body;

    if (!caller_user_id) {
      return jsonResponse({ error: "Sessão inválida." }, 401);
    }

    const admin = createClient(externalUrl, externalServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Check caller is admin
    const { data: callerPerm } = await admin
      .from("user_permissions")
      .select("is_admin")
      .eq("user_id", caller_user_id)
      .maybeSingle();

    if (!callerPerm?.is_admin) {
      return jsonResponse({ error: "Acesso negado: apenas administradores." }, 403);
    }

    if (!nome || !email || !password || !cpf) {
      return jsonResponse({ error: "Campos obrigatórios: nome, email, senha e cpf." }, 400);
    }

    const emailNormalized = String(email).trim().toLowerCase();
    if (String(password).length < 6) {
      return jsonResponse({ error: "Senha deve ter pelo menos 6 caracteres." }, 400);
    }

    const cpfClean = String(cpf).replace(/\D/g, "");

    // Check CPF uniqueness
    const { data: existingCpf } = await admin
      .from("user_profiles").select("id").eq("cpf", cpfClean).maybeSingle();
    if (existingCpf) {
      return jsonResponse({ error: "CPF já cadastrado." }, 400);
    }

    // Hash password
    const senhaHash = await hashPassword(String(password), cpfClean);
    const userId = crypto.randomUUID();

    // Insert profile
    const { error: profErr } = await admin.from("user_profiles").insert({
      id: userId,
      nome: String(nome).trim(),
      email: emailNormalized,
      cpf: cpfClean,
      senha_hash: senhaHash,
      ativo: true,
    });

    if (profErr) {
      return jsonResponse({ error: `Erro perfil: ${profErr.message}` }, 400);
    }

    const voucherAccess = !!acesso_voucher;
    const tempoVoucher = voucherAccess
      ? (tempo_voucher && String(tempo_voucher) !== "Todos" ? String(tempo_voucher) : null)
      : null;

    // Insert permissions
    const { error: permErr } = await admin.from("user_permissions").insert({
      user_id: userId,
      acesso_voucher: voucherAccess,
      acesso_cadastrar_produto: !!cadastrar_produto,
      acesso_ficha_consumo: !!ficha_consumo,
      acesso_comanda: !!acesso_comanda,
      is_admin: !!administrador,
      voucher_tempo_acesso: tempoVoucher,
    });

    if (permErr) {
      await admin.from("user_profiles").delete().eq("id", userId);
      return jsonResponse({ error: `Erro permissões: ${permErr.message}` }, 400);
    }

    return jsonResponse({ success: true, user_id: userId });
  } catch (err) {
    console.error("Edge function error:", err);
    return jsonResponse({ error: err instanceof Error ? err.message : "Erro interno" }, 500);
  }
});
