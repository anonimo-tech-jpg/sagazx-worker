export default {
  async fetch(request, env, ctx) {
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();

    if (!globalThis.clients) globalThis.clients = new Map();

    server.addEventListener("message", (msg) => {
      try {
        const data = JSON.parse(msg.data);
        
        if (data.type === "register") {
          // Força o userId a ser string para evitar erros de tipo
          const uidStr = String(data.userId);
          
          globalThis.clients.set(uidStr, {
            ws: server,
            userId: Number(data.userId),
            nome: data.nome,
            jobId: data.jobId,
            placeId: data.placeId,
            nomeJogo: data.nomeJogo
          });

          // ==========================================
          // Manda um "eco" só pra confirmar que tá vivo
          // ==========================================
          server.send(JSON.stringify({ 
            type: "ping", 
            mensagem: "Worker OK. Total online: " + globalThis.clients.size 
          }));

          // Monta a lista de TODO MUNDO online
          const online = [];
          for (const [uid, c] of globalThis.clients.entries()) {
            online.push({
              userId: c.userId,
              nome: c.nome,
              jobId: c.jobId,
              placeId: c.placeId,
              nomeJogo: c.nomeJogo
            });
          }

          // Envia a lista atualizada para todos os jogadores conectados
          for (const [uid, c] of globalThis.clients.entries()) {
            try {
              c.ws.send(JSON.stringify({ 
                type: "online_list", 
                players: online 
              }));
            } catch (e) {}
          }
        }
      } catch (e) {}
    });

    server.addEventListener("close", () => {
      for (const [userId, client] of globalThis.clients.entries()) {
        if (client.ws === server) {
          globalThis.clients.delete(userId);
          
          // Reenvia a lista atualizada para quem ficou
          const online = [];
          for (const [uid, c] of globalThis.clients.entries()) {
            online.push({
              userId: c.userId,
              nome: c.nome,
              jobId: c.jobId,
              placeId: c.placeId,
              nomeJogo: c.nomeJogo
            });
          }
          
          for (const [uid, c] of globalThis.clients.entries()) {
            try { c.ws.send(JSON.stringify({ type: "online_list", players: online })); } catch(e) {}
          }
          break;
        }
      }
    });

    return new Response(null, { status: 101, webSocket: client });
  }
};