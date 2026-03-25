import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Configuração ausente: ${name}`);
  return value;
}

function normalizeEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const e = v.trim().toLowerCase();
  return e || null;
}

function normalizeString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s || null;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
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
    const externalUrl = requireEnv("EXTERNAL_SUPABASE_URL");
    const externalServiceKey = requireEnv("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");

    const body = await req.json();
    if (!isObject(body)) return json({ error: "Payload inválido." }, 400);

    const callerUserId = normalizeString(body.caller_user_id);
    if (!callerUserId) return json({ error: "Sessão inválida." }, 401);

    const admin = createClient(externalUrl, externalServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Check caller is admin
    const { data: callerPerm } = await admin
      .from("user_permissions")
      .select("is_admin")
      .eq("user_id", callerUserId)
      .maybeSingle();

    if (!callerPerm?.is_admin) {
      return json({ error: "Acesso negado: apenas administradores." }, 403);
    }

    const { action } = body;

    // ==================== CREATE USER ====================
    if (action === "create-user") {
      const email = normalizeEmail(body.email);
      const password = normalizeString(body.password);
      const profile = isObject(body.profile) ? body.profile : {};
      const permissions = isObject(body.permissions) ? body.permissions : {};

      if (!email || !password) return json({ error: "Email e senha são obrigatórios." }, 400);
      if (password.length < 6) return json({ error: "Senha deve ter pelo menos 6 caracteres." }, 400);

      const nome = normalizeString(profile.nome) || "";
      const cpf = normalizeString(profile.cpf);
      const ativo = profile.ativo !== false;

      if (!cpf) return json({ error: "CPF é obrigatório." }, 400);

      const { data: existingCpf } = await admin
        .from("user_profiles").select("id").eq("cpf", cpf).maybeSingle();
      if (existingCpf) return json({ error: "CPF já cadastrado." }, 400);

      const senhaHash = await hashPassword(password, cpf);
      const userId = crypto.randomUUID();

      const { error: profErr } = await admin.from("user_profiles").insert({
        id: userId,
        nome,
        email,
        cpf,
        senha_hash: senhaHash,
        ativo,
      });

      if (profErr) {
        return json({ error: `Erro perfil: ${profErr.message}` }, 400);
      }

      const permData = {
        user_id: userId,
        acesso_voucher: !!permissions.acesso_voucher,
        acesso_cadastrar_produto: !!permissions.acesso_cadastrar_produto,
        acesso_ficha_consumo: !!permissions.acesso_ficha_consumo,
        acesso_comanda: !!permissions.acesso_comanda,
        is_admin: !!permissions.is_admin,
        voucher_tempo_acesso: normalizeString(permissions.voucher_tempo_acesso),
      };

      const { error: permErr } = await admin.from("user_permissions").insert(permData);
      if (permErr) {
        await admin.from("user_profiles").delete().eq("id", userId);
        return json({ error: `Erro permissões: ${permErr.message}` }, 400);
      }

      return json({ success: true, user_id: userId });
    }

    // ==================== UPDATE USER ====================
    if (action === "update-user") {
      const userId = normalizeString(body.user_id);
      if (!userId) return json({ error: "user_id é obrigatório." }, 400);

      const profile = isObject(body.profile) ? body.profile : {};
      const permissions = isObject(body.permissions) ? body.permissions : {};

      const profileUpdate: Record<string, unknown> = {};
      if (profile.nome !== undefined) profileUpdate.nome = normalizeString(profile.nome) || "";
      if (profile.email !== undefined) profileUpdate.email = normalizeEmail(profile.email);
      if (profile.cpf !== undefined) profileUpdate.cpf = normalizeString(profile.cpf);
      if (profile.ativo !== undefined) profileUpdate.ativo = profile.ativo;

      if (Object.keys(profileUpdate).length > 0) {
        const { error } = await admin.from("user_profiles")
          .update(profileUpdate)
          .eq("id", userId);
        if (error) return json({ error: `Erro perfil: ${error.message}` }, 400);
      }

      if (Object.keys(permissions).length > 0) {
        const permUpdate: Record<string, unknown> = {};
        if (permissions.acesso_voucher !== undefined) permUpdate.acesso_voucher = !!permissions.acesso_voucher;
        if (permissions.acesso_cadastrar_produto !== undefined) permUpdate.acesso_cadastrar_produto = !!permissions.acesso_cadastrar_produto;
        if (permissions.acesso_ficha_consumo !== undefined) permUpdate.acesso_ficha_consumo = !!permissions.acesso_ficha_consumo;
        if (permissions.acesso_comanda !== undefined) permUpdate.acesso_comanda = !!permissions.acesso_comanda;
        if (permissions.is_admin !== undefined) permUpdate.is_admin = !!permissions.is_admin;
        if (permissions.voucher_tempo_acesso !== undefined) permUpdate.voucher_tempo_acesso = normalizeString(permissions.voucher_tempo_acesso);

        const { error } = await admin.from("user_permissions")
          .upsert({ user_id: userId, ...permUpdate }, { onConflict: "user_id" });
        if (error) return json({ error: `Erro permissões: ${error.message}` }, 400);
      }

      return json({ success: true });
    }

    // ==================== DELETE USER ====================
    if (action === "delete-user") {
      const userId = normalizeString(body.user_id);
      if (!userId) return json({ error: "user_id é obrigatório." }, 400);

      await admin.from("user_permissions").delete().eq("user_id", userId);
      await admin.from("user_profiles").delete().eq("id", userId);

      return json({ success: true });
    }

    // ==================== RESET PASSWORD ====================
    if (action === "reset-password") {
      const userId = normalizeString(body.user_id);
      const newPassword = normalizeString(body.new_password);
      if (!userId || !newPassword) return json({ error: "user_id e new_password obrigatórios." }, 400);
      if (newPassword.length < 6) return json({ error: "Senha deve ter pelo menos 6 caracteres." }, 400);

      // Get user CPF for salt
      const { data: userProfile } = await admin.from("user_profiles")
        .select("cpf")
        .eq("id", userId)
        .maybeSingle();

      if (!userProfile?.cpf) return json({ error: "Usuário sem CPF cadastrado." }, 400);

      const senhaHash = await hashPassword(newPassword, userProfile.cpf);
      const { error } = await admin.from("user_profiles")
        .update({ senha_hash: senhaHash })
        .eq("id", userId);

      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    // ==================== TOGGLE ATIVO ====================
    if (action === "toggle-ativo") {
      const userId = normalizeString(body.user_id);
      if (!userId) return json({ error: "user_id é obrigatório." }, 400);

      const { error } = await admin.from("user_profiles")
        .update({ ativo: !!body.ativo })
        .eq("id", userId);
      if (error) return json({ error: error.message }, 400);

      return json({ success: true });
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (err) {
    console.error("Edge function error:", err);
    return json({ error: err instanceof Error ? err.message : "Erro interno" }, 500);
  }
});
