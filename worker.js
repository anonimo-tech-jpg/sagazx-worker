export default {
  async fetch(request, env, ctx) {
    const upgradeHeader = request.headers.get("Upgrade");
    
    // Se não for WebSocket, retorna erro 426 (Upgrade Required)
    if (upgradeHeader !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Aceita a conexão
    server.accept();

    // Inicializa a memória se não existir
    if (!globalThis.clients) globalThis.clients = new Map();

    server.addEventListener("message", (msg) => {
      try {
        const data = JSON.parse(msg.data);
        
        if (data.type === "register") {
          // Salva o player que acabou de conectar
          globalThis.clients.set(data.userId, {
            ws: server,
            nome: data.nome,
            jobId: data.jobId,
            placeId: data.placeId,
            nomeJogo: data.nomeJogo
          });

          // Avisa todos os outros que esse player entrou
          for (const [uid, c] of globalThis.clients.entries()) {
            if (uid !== data.userId) {
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

          // Manda para o player que acabou de entrar a lista de quem já estava online
          const online = [];
          for (const [uid, c] of globalThis.clients.entries()) {
            if (uid !== data.userId) {
              online.push({
                userId: Number(uid),
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
      // Remove o player da lista quando ele desconecta
      for (const [userId, client] of globalThis.clients.entries()) {
        if (client.ws === server) {
          globalThis.clients.delete(userId);
          // Avisa os outros que ele saiu
          for (const [uid, c] of globalThis.clients.entries()) {
            if (uid !== userId) {
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