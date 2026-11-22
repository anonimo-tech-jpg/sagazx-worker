// 1. PORTA DE ENTRADA: Recebe o WebSocket e manda pra Sala
export default {
  async fetch(request, env, ctx) {
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    const id = env.TAG_ROOM.idFromName("sala_principal");
    const stub = env.TAG_ROOM.get(id);
    
    return stub.fetch(request);
  }
};

// 2. A SALA (Durable Object): Aqui a mágica acontece
export class TagRoom {
  constructor(state, env) {
    this.state = state;
    this.sessions = [];
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
          websocket.userId = data.userId;
          websocket.nome = data.nome;
          websocket.jobId = data.jobId;
          websocket.placeId = data.placeId;
          websocket.nomeJogo = data.nomeJogo;

          websocket.send(JSON.stringify({ type: "ping", mensagem: "Conectado na Sala!" }));
          
          this.broadcast();
        }
      } catch (e) {}
    });

    websocket.addEventListener("close", () => {
      this.sessions = this.sessions.filter(s => s !== websocket);
      this.broadcast();
    });
  }

  broadcast() {
    const players = [];
    
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

    for (const s of this.sessions) {
      try {
        s.send(JSON.stringify({ type: "online_list", players: players }));
      } catch (e) {}
    }
  }
}