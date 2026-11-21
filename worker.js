export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Memória do Worker (reseta quando o Worker reinicia, mas é suficiente para presença rápida)
    if (!globalThis.players) globalThis.players = new Map();

    // Rota que o script Lua chama
    if (url.pathname === "/online") {
      const userId = url.searchParams.get("userId");
      const nome = url.searchParams.get("nome");
      const jobId = url.searchParams.get("jobId");
      const placeId = url.searchParams.get("placeId");
      const nomeJogo = url.searchParams.get("nomeJogo");

      if (!userId) return new Response("Erro", { status: 400 });

      // Salva/Atualiza quem está chamando
      globalThis.players.set(userId, {
        userId: Number(userId),
        nome: nome || "Desconhecido",
        jobId: jobId || "",
        placeId: Number(placeId) || 0,
        nomeJogo: nomeJogo || "Desconhecido",
        lastSeen: Date.now()
      });

      // Limpa quem não dá sinal há mais de 10 segundos
      const agora = Date.now();
      for (const [uid, p] of globalThis.players.entries()) {
        if (agora - p.lastSeen > 10000) {
          globalThis.players.delete(uid);
        }
      }

      // Monta a lista de quem está online (exceto quem perguntou)
      const online = [];
      for (const [uid, p] of globalThis.players.entries()) {
        if (uid !== userId) {
          online.push({
            userId: p.userId,
            nome: p.nome,
            jobId: p.jobId,
            placeId: p.placeId,
            nomeJogo: p.nomeJogo
          });
        }
      }

      return new Response(JSON.stringify({ players: online }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response("Not found", { status: 404 });
  }
};