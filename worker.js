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
          globalThis.clients.set(data.userId, {
            ws: server,
            userId: data.userId,
            nome: data.nome,
            jobId: data.jobId,
            placeId: data.placeId,
            nomeJogo: data.nomeJogo
          });

          // ==========================================
          // TESTE: Manda um "eco" de volta para quem acabou de entrar
          // ==========================================
          server.send(JSON.stringify({ 
            type: "ping", 
            mensagem: "Worker recebeu seu registro com sucesso!" 
          }));

          // Avisa os outros do MESMO SERVIDOR
          for (const [uid, c] of globalThis.clients.entries()) {
            if (uid !== data.userId && c.jobId === data.jobId) {
              try {
                c.ws.send(JSON.stringify({
                  type: "player_joined",
                  userId: data.userId,
                  nome: data.nome,
                  jobId: data.jobId,
                  placeId: data.placeId,
                  nomeJogo: data.nomeJogo
                }));
              } catch (e) {}
            }
          }

          // Manda a lista de quem já estava no MESMO SERVIDOR
          const online = [];
          for (const [uid, c] of globalThis.clients.entries()) {
            if (uid !== data.userId && c.jobId === data.jobId) {
              online.push({
                userId: c.userId,
                nome: c.nome,
                jobId: c.jobId,
                placeId: c.placeId,
                nomeJogo: c.nomeJogo
              });
            }
          }
          if (online.length > 0) {
            server.send(JSON.stringify({ type: "online_list", players: online }));
          }
        }
      } catch (e) {}
    });

    server.addEventListener("close", () => {
      for (const [userId, client] of globalThis.clients.entries()) {
        if (client.ws === server) {
          globalThis.clients.delete(userId);
          for (const [uid, c] of globalThis.clients.entries()) {
            if (uid !== userId && c.jobId === client.jobId) {
              try { c.ws.send(JSON.stringify({ type: "player_left", userId: Number(userId) })); } catch(e) {}
            }
          }
          break;
        }
      }
    });

    return new Response(null, { status: 101, webSocket: client });
  }
};