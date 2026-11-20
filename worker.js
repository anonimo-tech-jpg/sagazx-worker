export default {
  async fetch(request, env, ctx) {
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader === "websocket") {
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
              nome: data.nome,
              jobId: data.jobId,
              placeId: data.placeId,
              nomeJogo: data.nomeJogo
            });

            // 1. Avisa os outros que você entrou
            broadcast(JSON.stringify({
              type: "player_joined",
              userId: data.userId,
              nome: data.nome,
              jobId: data.jobId,
              placeId: data.placeId,
              nomeJogo: data.nomeJogo
            }), data.userId);

            // 2. NOVO: Manda para VOCÊ a lista de quem já estava online
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
        for (const [userId, client] of globalThis.clients.entries()) {
          if (client.ws === server) {
            globalThis.clients.delete(userId);
            broadcast(JSON.stringify({ type: "player_left", userId }), userId);
            break;
          }
        }
      });

      return new Response(null, { status: 101, webSocket: client });
    }
    return new Response("Not found", { status: 404 });
  }
};

function broadcast(message, senderId) {
  if (globalThis.clients) {
    for (const [userId, client] of globalThis.clients.entries()) {
      if (userId !== senderId) {
        try {
          client.ws.send(message);
        } catch (e) {
          globalThis.clients.delete(userId);
        }
      }
    }
  }
}