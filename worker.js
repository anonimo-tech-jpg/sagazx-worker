export default {
  async fetch(request, env, ctx) {
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      server.accept();

      // Armazena o WebSocket do jogador na memória
      if (!globalThis.clients) globalThis.clients = new Map();
      
      server.addEventListener("message", (msg) => {
        try {
          const data = JSON.parse(msg.data);
          
          if (data.type === "register") {
            // Salva quem é o jogador e onde ele está
            globalThis.clients.set(data.userId, {
              ws: server,
              nome: data.nome,
              jobId: data.jobId,
              placeId: data.placeId,
              nomeJogo: data.nomeJogo
            });

            // Avisa TODOS os outros jogadores que esse cara entrou
            broadcast(JSON.stringify({
              type: "player_joined",
              userId: data.userId,
              nome: data.nome,
              jobId: data.jobId,
              placeId: data.placeId,
              nomeJogo: data.nomeJogo
            }), data.userId);
          }
        } catch (e) {}
      });

      // Quando o jogador sai
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