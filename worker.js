// 1. PORTA DE ENTRADA: Recebe o WebSocket e manda pra Sala
export default {
  async fetch(request, env, ctx) {
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    // Pega a "Sala Global" (todos caem na mesma)
    const id = env.TAG_ROOM.idFromName("sala_principal");
    const stub = env.TAG_ROOM.get(id);
    
    return stub.fetch(request);
  }
};

// 2. A SALA (Durable Object): Aqui a mágica acontece
export class TagRoom {
  constructor(state, env) {
    this.state = state;
    this.sessions = []; // Guarda os WebSockets de todos
  }

  async fetch(request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.handleSession(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  async handleSession(websocket) {
    websocket.accept();
    this.sessions.push(websocket);

    websocket.addEventListener("message", (msg) => {
      try {
        const data = JSON.parse(msg.data);
        
        if (data.type === "register") {
          // Salva os dados do player no próprio WebSocket
          websocket.userId = data.userId;
          websocket.nome = data.nome;
          websocket.jobId = data.jobId;
          websocket.placeId = data.placeId;
          websocket.nomeJogo = data.nomeJogo;

          // Manda um "Ping" de confirmação
          websocket.send(JSON.stringify({ type: "ping", mensagem: "Conectado na Sala!" }));
          
          // Atualiza a lista de todo mundo
          this.broadcast();
        }
      } catch (e) {}
    });

    websocket.addEventListener("close", () => {
      // Remove quem saiu e atualiza a lista
      this.sessions = this.sessions.filter(s => s !== websocket);
      this.broadcast();
    });
  }

  // Avisa todo mundo quem está online (filtrado pelo mesmo jogo/servidor)
  broadcast() {
    const players = [];
    
    // Pega todos que já se registraram
    for (const s of this.sessions) {
      if (s.userId) {
        players.push({
          userId: s.userId,
          nome: s.nome,
          jobId: s.jobId,
          placeId: s.placeId,
          nomeJogo: s.nomeJogo
        });
      }
    }

    // Manda a lista atualizada para todos
    for (const s of this.sessions) {
      try {
        s.send(JSON.stringify({ type: "online_list", players: players }));
      } catch (e) {}
    }
  }
}