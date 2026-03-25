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

    const admin = createClient(externalUrl, externalServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Check if any admin already exists
    const { data: existingAdmin, error: checkErr } = await admin
      .from("user_permissions")
      .select("user_id")
      .eq("is_admin", true)
      .limit(1)
      .maybeSingle();

    if (checkErr) {
      return jsonResponse({ error: `Erro ao verificar administradores: ${checkErr.message}` }, 400);
    }

    if (existingAdmin) {
      return jsonResponse({ error: "Já existe um administrador cadastrado no sistema." }, 403);
    }

    const body = await req.json();
    const { nome, email, password, cpf } = body;

    if (!nome || !email || !password || !cpf) {
      return jsonResponse({ error: "Campos obrigatórios: nome, email, senha e cpf." }, 400);
    }

    if (String(password).length < 6) {
      return jsonResponse({ error: "A senha deve ter pelo menos 6 caracteres." }, 400);
    }

    const cpfClean = String(cpf).replace(/\D/g, "");
    const emailNormalized = String(email).trim().toLowerCase();

    // Check CPF uniqueness
    const { data: existingCpf } = await admin
      .from("user_profiles")
      .select("id")
      .eq("cpf", cpfClean)
      .maybeSingle();

    if (existingCpf) {
      return jsonResponse({ error: "Já existe um usuário cadastrado com este CPF." }, 400);
    }

    // Hash password using CPF as salt
    const senhaHash = await hashPassword(String(password), cpfClean);

    // Generate UUID for the user
    const userId = crypto.randomUUID();

    // Insert profile with senha_hash
    const { error: profErr } = await admin.from("user_profiles").insert({
      id: userId,
      nome: String(nome).trim(),
      email: emailNormalized,
      cpf: cpfClean,
      senha_hash: senhaHash,
      ativo: true,
    });

    if (profErr) {
      return jsonResponse({ error: `Erro ao salvar perfil: ${profErr.message}` }, 400);
    }

    // Insert permissions - all enabled as admin
    const { error: permErr } = await admin.from("user_permissions").insert({
      user_id: userId,
      acesso_voucher: true,
      acesso_cadastrar_produto: true,
      acesso_ficha_consumo: true,
      acesso_comanda: true,
      is_admin: true,
      voucher_tempo_acesso: null,
    });

    if (permErr) {
      await admin.from("user_profiles").delete().eq("id", userId);
      return jsonResponse({ error: `Erro ao salvar permissões: ${permErr.message}` }, 400);
    }

    return jsonResponse({ success: true, user_id: userId });
  } catch (err) {
    console.error("Edge function error:", err);
    const msg = err instanceof Error ? err.message : "Erro interno";
    return jsonResponse({ error: msg }, 500);
  }
});
