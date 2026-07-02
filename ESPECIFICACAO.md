# PixelRooms — Especificação Completa do Projeto

> **Documento-guia de implementação.** Este arquivo é a fonte de verdade do projeto PixelRooms:
> um clone open source do Gather Town, com gráficos 2D pixelados e backend em Go.
> Ele foi escrito para orientar todo o desenvolvimento futuro do código — arquitetura,
> requisitos, formatos de assets, protocolo de rede e roadmap.

---

## Índice

1. [O que é o Gather Town](#1-o-que-é-o-gather-town)
2. [O Projeto PixelRooms — Intenção e Descrição](#2-o-projeto-pixelrooms--intenção-e-descrição)
3. [Requisitos Funcionais](#3-requisitos-funcionais)
4. [Requisitos Não Funcionais](#4-requisitos-não-funcionais)
5. [Especificação Gráfica — Pixel Art, Tiles e Sprites](#5-especificação-gráfica--pixel-art-tiles-e-sprites)
6. [Arquitetura e Stack Tecnológica](#6-arquitetura-e-stack-tecnológica)
7. [Protocolo de Comunicação em Tempo Real](#7-protocolo-de-comunicação-em-tempo-real)
8. [Modelo de Dados](#8-modelo-de-dados)
9. [Estrutura de Diretórios do Monorepo](#9-estrutura-de-diretórios-do-monorepo)
10. [Roadmap de Implementação](#10-roadmap-de-implementação)
11. [Glossário](#11-glossário)

---

## 1. O que é o Gather Town

O **Gather Town** (gather.town) é uma plataforma de escritório virtual e eventos online que
combina **videoconferência** com um **mundo 2D estilo videogame retrô**. Cada usuário controla
um avatar pixelado que anda por um mapa (um escritório, uma sala de conferência, um campus),
e a mecânica central é a **conversa por proximidade**: quando dois avatares se aproximam,
o vídeo e o áudio de um aparecem para o outro gradualmente; quando se afastam, a chamada
se desfaz — exatamente como acontece em um espaço físico.

### 1.1 Conceitos centrais do Gather

| Conceito | Descrição |
|---|---|
| **Space (Espaço)** | Um "mundo" independente com um ou mais mapas, membros e permissões. Equivale a um escritório ou evento. Acessível por URL própria. |
| **Map (Mapa/Sala)** | Um grid 2D de tiles com cenário, objetos e efeitos de tile. Um Space pode ter vários mapas conectados por portais. |
| **Avatar** | Personagem pixelado customizável (corpo, cabelo, roupa, acessórios) que representa o usuário e anda pelo mapa em 4 direções. |
| **Conversa por proximidade** | Vídeo/áudio via WebRTC ativado automaticamente quando avatares estão a até N tiles de distância, com fade de volume conforme a distância. |
| **Private Area (Área Privada)** | Região de tiles marcada com um ID; todos que estão dentro dela se veem/ouvem entre si, e ninguém de fora participa. Usada para salas de reunião, mesas, "salinhas". |
| **Spotlight** | Tile especial que, ao ser pisado, transmite o áudio/vídeo do usuário para **todos** no mapa (modo palestrante/broadcast). |
| **Portal** | Tile que teleporta o avatar para outro ponto do mesmo mapa ou para outro mapa. |
| **Spawn** | Tile onde novos usuários aparecem ao entrar no mapa. |
| **Impassable** | Tile de colisão — o avatar não pode atravessar (paredes, móveis). |
| **Objetos interativos** | Itens colocados no mapa (TV, quadro branco, pôster, jogos) que, ao apertar a tecla de interação (X) perto deles, abrem conteúdo embutido: iframe de site, vídeo, imagem, nota de texto, quadro colaborativo. |
| **Map Maker** | Editor visual integrado para desenhar mapas: pintar pisos/paredes, posicionar objetos e marcar efeitos de tile. |
| **Ghost mode** | Segurar uma tecla (G) permite atravessar outros avatares sem iniciar conversa. |
| **Emotes e status** | Reações rápidas sobre a cabeça do avatar (👋 ❤️ 🎉 👍 ❓ 😂), status "ocupado/disponível", mensagem de status. |
| **Chat de texto** | Mensagens para: pessoas próximas (Nearby), todos do mapa/espaço (Everyone) ou diretas (DM). |
| **Screen share** | Compartilhamento de tela dentro da conversa por proximidade ou em spotlight. |
| **Follow / Locate** | Seguir automaticamente outro avatar, ou traçar uma linha no chão até a pessoa procurada. |
| **Moderação** | Papéis (owner, admin/builder, moderator, member, guest), banimento, expulsão, mute, senha de espaço, bloqueio de convidados. |

### 1.2 A experiência típica

1. O usuário recebe uma URL (`app.gather.town/app/<id>/<nome-do-espaco>`), escolhe nome e avatar,
   testa câmera/microfone e entra.
2. Aparece no tile de spawn e anda com WASD/setas.
3. Ao se aproximar de colegas, os vídeos deles surgem em cartões no topo da tela e o áudio faz
   fade-in; ao se afastar, fade-out e desconexão.
4. Entra numa sala de reunião (private area) e conversa apenas com quem está lá dentro.
5. Interage com objetos (aperta X perto de um quadro branco e ele abre em um painel embutido).
6. Em eventos, um palestrante pisa no spotlight e é transmitido para todo o mapa.

O grande diferencial do Gather é transformar presença remota em algo **espacial e espontâneo**:
encontros de corredor, "puxar uma cadeira" numa conversa, geografia social — coisas que o
Zoom/Meet não têm.

---

## 2. O Projeto PixelRooms — Intenção e Descrição

### 2.1 Intenção

**PixelRooms** é um aplicativo web **open source** (licença MIT) que replica as funcionalidades
do Gather Town, com estética de **pixel art 2D**, e que qualquer pessoa ou organização pode
**auto-hospedar** (self-host) gratuitamente.

Motivações:

- **Soberania de dados**: empresas, escolas e comunidades podem rodar seu próprio escritório
  virtual sem depender de SaaS pago nem enviar vídeo/áudio para terceiros.
- **Custo**: o Gather é pago por usuário; PixelRooms é gratuito e o custo é só a infraestrutura.
- **Extensibilidade**: mapas, avatares, objetos e integrações abertos e documentados, para a
  comunidade criar conteúdo (tilesets, minigames, plugins).
- **Aprendizado e referência**: uma base de código limpa em Go + TypeScript demonstrando
  arquitetura de mundo virtual multiplayer com WebRTC.

### 2.2 Descrição do produto

PixelRooms é um mundo 2D top-down pixelado onde usuários:

- criam **espaços** com mapas customizados (via editor embutido ou importação do Tiled);
- andam com **avatares pixelados customizáveis**;
- conversam por **vídeo/áudio por proximidade** (WebRTC, arquitetura SFU);
- usam **áreas privadas, spotlight, portais e objetos interativos**;
- trocam **chat de texto** e **emotes**;
- administram membros, papéis e permissões.

Paridade de funcionalidades com o Gather é o objetivo de longo prazo; o roadmap
(seção 10) define a ordem de construção.

### 2.3 Público-alvo

- Times remotos que querem um escritório virtual self-hosted.
- Organizadores de eventos/comunidades (conferências, meetups, aulas).
- Desenvolvedores que querem estender/estudar a plataforma.

### 2.4 Fora de escopo (pelo menos inicialmente)

- Aplicativos nativos desktop/mobile (o alvo é navegador; mobile web responsivo vem depois).
- Gravação de reuniões.
- Recursos pagos do Gather como integração com calendário corporativo, analytics avançado
  e SSO SAML (SSO via OAuth genérico entra no roadmap).

---

## 3. Requisitos Funcionais

Convenção: `RF-<área>-<número>`. Prioridade: **P0** = MVP, **P1** = pós-MVP, **P2** = futuro.

### 3.1 Contas e Autenticação (AUTH)

| ID | Requisito | Prioridade |
|---|---|---|
| RF-AUTH-01 | Cadastro e login com e-mail + senha (hash Argon2id). | P0 |
| RF-AUTH-02 | Login como **convidado** (apenas nome, sem conta) quando o espaço permitir. | P0 |
| RF-AUTH-03 | Sessão via JWT de curta duração + refresh token httpOnly. | P0 |
| RF-AUTH-04 | Login social OAuth2 (Google, GitHub) plugável. | P1 |
| RF-AUTH-05 | Recuperação de senha por e-mail (token de uso único). | P1 |
| RF-AUTH-06 | Perfil do usuário: nome de exibição, avatar salvo, e-mail. | P0 |

### 3.2 Espaços (SPACE)

| ID | Requisito | Prioridade |
|---|---|---|
| RF-SPACE-01 | Criar espaço com nome, slug único (URL) e template de mapa inicial. | P0 |
| RF-SPACE-02 | Acesso por URL: `/<slug-do-espaco>`. | P0 |
| RF-SPACE-03 | Um espaço contém **1..N mapas**; um deles é o mapa inicial (spawn padrão). | P0 |
| RF-SPACE-04 | Papéis por espaço: `owner`, `admin`, `builder`, `moderator`, `member`, `guest`. | P0 |
| RF-SPACE-05 | Controle de acesso: público, protegido por senha, apenas membros convidados. | P0 |
| RF-SPACE-06 | Convite de membros por link e por e-mail. | P1 |
| RF-SPACE-07 | Capacidade configurável por espaço (limite de usuários simultâneos). | P1 |
| RF-SPACE-08 | Excluir/arquivar espaço (apenas owner). | P1 |

### 3.3 Movimento e Mundo (WORLD)

| ID | Requisito | Prioridade |
|---|---|---|
| RF-WORLD-01 | Movimento do avatar em grid, 4 direções, com teclas WASD e setas. | P0 |
| RF-WORLD-02 | Movimento contínuo tile-a-tile com animação de caminhada interpolada (sem "teleporte" visual entre tiles). | P0 |
| RF-WORLD-03 | Colisão com tiles `impassable` e com limites do mapa, validada **no servidor** (servidor autoritativo). | P0 |
| RF-WORLD-04 | Posições dos outros jogadores sincronizadas em tempo real (≤ 200 ms de percepção), com interpolação no cliente. | P0 |
| RF-WORLD-05 | Tile **spawn**: ponto(s) de entrada; se vários, escolher aleatório/round-robin. | P0 |
| RF-WORLD-06 | Tile **portal**: teleporta para coordenada de outro mapa ou do mesmo mapa. | P0 |
| RF-WORLD-07 | **Ghost mode** (segurar G): atravessa avatares e não inicia conversa; avatar fica semitransparente. | P1 |
| RF-WORLD-08 | Clique-para-andar com pathfinding A* no cliente (validação por passo no servidor). | P1 |
| RF-WORLD-09 | **Follow**: seguir automaticamente outro usuário. | P2 |
| RF-WORLD-10 | **Locate**: desenhar caminho no chão até um usuário escolhido. | P2 |
| RF-WORLD-11 | Avatar sentado ao interagir com tile/objeto de cadeira (animação "sit"). | P1 |
| RF-WORLD-12 | Dança/idle animado como emote de corpo (tecla Z). | P2 |

### 3.4 Avatar (AVATAR)

| ID | Requisito | Prioridade |
|---|---|---|
| RF-AVATAR-01 | Editor de avatar por camadas: corpo/pele, cabelo, roupa de cima, roupa de baixo, acessório, chapéu. | P0 (mínimo: corpo + cabelo + roupa) |
| RF-AVATAR-02 | Nome exibido acima do avatar; cor/badge conforme papel. | P0 |
| RF-AVATAR-03 | Avatar persistido no perfil do usuário. | P0 |
| RF-AVATAR-04 | Indicador visual de status: falando (borda/ícone), mudo, ausente, ocupado. | P1 |
| RF-AVATAR-05 | Emotes sobre a cabeça (teclas 1–6): 👋 ❤️ 🎉 👍 ❓ 😂 — somem após ~3 s (o ❓ persiste até cancelar). | P1 |

### 3.5 Vídeo e Áudio por Proximidade (RTC)

| ID | Requisito | Prioridade |
|---|---|---|
| RF-RTC-01 | Conexão de áudio+vídeo automática quando dois avatares estão a ≤ 5 tiles de distância (raio configurável por mapa). | P0 |
| RF-RTC-02 | Fade de volume conforme distância (100% até 2 tiles, decaindo linearmente até 0% no limite do raio). | P1 |
| RF-RTC-03 | Desconexão automática (com histerese de ~1 tile e delay de ~1 s para evitar flicker). | P0 |
| RF-RTC-04 | **Área privada**: dentro de tiles com o mesmo `areaId`, todos se conectam entre si e ninguém de fora ouve/vê; o resto do mapa fica com vídeo esmaecido. | P0 |
| RF-RTC-05 | **Spotlight**: usuário em tile spotlight transmite para todos no mapa; múltiplos spotlights simultâneos suportados. | P1 |
| RF-RTC-06 | Compartilhamento de tela dentro da conversa atual. | P1 |
| RF-RTC-07 | Controles: mute mic, desligar câmera, selecionar dispositivos, tela de teste antes de entrar. | P0 |
| RF-RTC-08 | Grade de vídeos no topo da tela; clicar expande; modo grid para reuniões. | P1 |
| RF-RTC-09 | Arquitetura **SFU** (Selective Forwarding Unit) — não mesh — para escalar além de ~6 participantes. | P0 |
| RF-RTC-10 | Simulcast e ajuste de qualidade conforme banda e tamanho do vídeo na tela. | P1 |
| RF-RTC-11 | Push-to-talk opcional. | P2 |

### 3.6 Chat de Texto e Presença (CHAT)

| ID | Requisito | Prioridade |
|---|---|---|
| RF-CHAT-01 | Chat com escopos: **Nearby** (quem está no raio/área), **Map**, **Space (Everyone)** e **DM**. | P0 (mínimo: Map + Nearby) |
| RF-CHAT-02 | Histórico persistido por espaço (retenção configurável). | P1 |
| RF-CHAT-03 | Lista de participantes online com busca, status e localização (mapa atual). | P0 |
| RF-CHAT-04 | Notificações de menção e DM (badge + som opcional). | P1 |
| RF-CHAT-05 | Links clicáveis e sanitização de HTML nas mensagens. | P0 |

### 3.7 Objetos Interativos (OBJ)

| ID | Requisito | Prioridade |
|---|---|---|
| RF-OBJ-01 | Objetos posicionados no mapa com sprite, footprint de colisão e distância de interação. | P0 |
| RF-OBJ-02 | Realce (outline/brilho) do objeto interativo mais próximo + hint "Pressione X". | P0 |
| RF-OBJ-03 | Tipos de interação: **iframe embutido** (site), **imagem**, **vídeo** (YouTube/arquivo), **nota de texto**, **link externo**. | P0 (mínimo: iframe + imagem + nota) |
| RF-OBJ-04 | Quadro branco colaborativo (integração com Excalidraw embutido via iframe). | P1 |
| RF-OBJ-05 | Objetos com estado sincronizado (ex.: TV que todos veem tocando o mesmo vídeo). | P2 |
| RF-OBJ-06 | Catálogo de objetos com sprites pixel art embutidos + upload de sprite customizado. | P1 |

### 3.8 Editor de Mapas (EDIT)

| ID | Requisito | Prioridade |
|---|---|---|
| RF-EDIT-01 | Importação de mapas no formato **Tiled (.tmj/JSON)** com camadas e propriedades convencionadas (seção 5.6). | P0 |
| RF-EDIT-02 | Editor visual no navegador (papel `builder`+): pintar tiles de tileset, borracha, balde, camadas. | P1 |
| RF-EDIT-03 | Pintar **efeitos de tile**: impassable, spawn, portal, private area (com areaId), spotlight. | P1 |
| RF-EDIT-04 | Posicionar/remover/configurar objetos interativos. | P1 |
| RF-EDIT-05 | Upload de tilesets customizados (PNG, grid 32×32). | P1 |
| RF-EDIT-06 | Templates de mapa prontos (escritório P/M/G, auditório, praça). | P1 |
| RF-EDIT-07 | Edição ao vivo: mudanças publicadas refletem para usuários conectados sem reload. | P2 |
| RF-EDIT-08 | Undo/redo e versionamento simples de mapas. | P2 |

### 3.9 Moderação e Administração (MOD)

| ID | Requisito | Prioridade |
|---|---|---|
| RF-MOD-01 | Kick (expulsar da sessão) e ban (bloquear por conta/IP) por moderadores+. | P0 |
| RF-MOD-02 | Mute forçado de um usuário no espaço. | P1 |
| RF-MOD-03 | Gerenciar papéis dos membros (promover/rebaixar). | P0 |
| RF-MOD-04 | Trancar espaço (impedir novas entradas) e limpar chat. | P1 |
| RF-MOD-05 | Denúncia de usuário com registro para admins. | P2 |
| RF-MOD-06 | Painel do espaço: membros, banidos, configurações, estatísticas básicas de presença. | P1 |

### 3.10 Plataforma (PLAT)

| ID | Requisito | Prioridade |
|---|---|---|
| RF-PLAT-01 | Onboarding: escolher nome/avatar + testar câmera/microfone antes de entrar. | P0 |
| RF-PLAT-02 | Minimapa do mapa atual. | P2 |
| RF-PLAT-03 | Atalhos de teclado documentados em modal (tecla ?). | P1 |
| RF-PLAT-04 | i18n — interface em pt-BR e en no mínimo. | P1 |
| RF-PLAT-05 | API HTTP pública documentada (OpenAPI) para gerenciar espaços/mapas programaticamente. | P1 |
| RF-PLAT-06 | Webhooks/plugins server-side (eventos: user_joined, user_left, chat_message). | P2 |

---

## 4. Requisitos Não Funcionais

Convenção: `RNF-<número>`.

### 4.1 Desempenho e Escalabilidade

| ID | Requisito |
|---|---|
| RNF-01 | **Latência de movimento**: atualização de posição percebida em ≤ 200 ms em rede doméstica típica; tick do servidor de simulação a **20 Hz** (50 ms). |
| RNF-02 | **Capacidade por mapa**: mínimo 50 usuários simultâneos por mapa em um VPS de 4 vCPU/8 GB, com meta de 200+. Vídeo simultâneo limitado pelo SFU, não pelo game server. |
| RNF-03 | **Broadcast eficiente**: posição enviada por *interest area* (apenas para quem está no mesmo mapa; futuramente, culling por viewport). Mensagens de movimento em formato binário compacto. |
| RNF-04 | **Escala horizontal**: game servers stateless quanto a persistência; estado de sala em memória com possibilidade de sharding por mapa; pub/sub via Redis para eventos entre nós (P1). |
| RNF-05 | **Cliente**: 60 FPS de renderização em hardware modesto (Intel iGPU); bundle inicial ≤ 5 MB gzip (sem contar assets de mapa, carregados sob demanda). |
| RNF-06 | Assets (tilesets, spritesheets, mapas) servidos com cache HTTP imutável (hash no nome do arquivo). |

### 4.2 Confiabilidade

| ID | Requisito |
|---|---|
| RNF-07 | Reconexão automática de WebSocket com backoff exponencial e reidratação do estado (posição, sala) transparente ao usuário. |
| RNF-08 | Reconexão de WebRTC independente do WebSocket (perda de mídia não derruba o mundo, e vice-versa). |
| RNF-09 | Sem perda de dados persistidos em crash do game server (o que está no Postgres é a verdade; estado volátil de sala é reconstruível). |
| RNF-10 | Health checks (`/healthz`, `/readyz`) e desligamento gracioso (drena salas antes de encerrar). |

### 4.3 Segurança e Privacidade

| ID | Requisito |
|---|---|
| RNF-11 | Todo tráfego sob TLS (HTTPS/WSS); mídia WebRTC cifrada (DTLS-SRTP) por padrão do protocolo. |
| RNF-12 | Servidor **autoritativo**: cliente nunca decide colisão, permissões de área, papel ou alcance de chat — apenas envia intenções. |
| RNF-13 | Sanitização de todo conteúdo gerado por usuário (chat, nomes, notas) contra XSS; iframes de objetos com `sandbox` e allowlist de domínios configurável por espaço. |
| RNF-14 | Rate limiting por conexão (movimento, chat, chamadas de API) e proteção de login (limite de tentativas). |
| RNF-15 | Senhas com Argon2id; tokens de sessão de curta duração; secrets fora do código (env). |
| RNF-16 | LGPD/GDPR-friendly: exclusão de conta apaga dados pessoais; instância não envia telemetria externa por padrão. |
| RNF-17 | Uploads (sprites, tilesets) validados: tipo real do arquivo, dimensões máximas, tamanho ≤ 2 MB, re-encode do PNG. |

### 4.4 Open Source e Operação

| ID | Requisito |
|---|---|
| RNF-18 | Licença **MIT**. Todos os assets gráficos próprios sob CC0 ou CC-BY; assets de terceiros só com licença compatível (ex.: Kenney CC0, LPC CC-BY-SA em pacote separado e sinalizado). |
| RNF-19 | **Deploy com um comando**: `docker compose up` sobe tudo (backend, frontend, Postgres, Redis, SFU, TURN). Documentação de self-hosting completa. |
| RNF-20 | Configuração 100% por variáveis de ambiente/arquivo YAML; valores padrão sensatos. |
| RNF-21 | CI com lint (golangci-lint, eslint), testes e build de imagens Docker multi-arch. |
| RNF-22 | Cobertura de testes: lógica de domínio do servidor (colisão, proximidade, áreas, permissões) ≥ 80%. |
| RNF-23 | Observabilidade: logs estruturados (slog), métricas Prometheus (usuários online, salas, ticks, mensagens/s), tracing opcional (OTel). |
| RNF-24 | Documentação de contribuição (CONTRIBUTING.md), código de conduta e protocolo de rede documentado em `docs/`. |

### 4.5 Usabilidade e Acessibilidade

| ID | Requisito |
|---|---|
| RNF-25 | Navegadores suportados: últimas 2 versões de Chrome, Firefox, Edge e Safari. |
| RNF-26 | Interface de UI (fora do canvas) acessível: navegável por teclado, contraste AA, `aria-labels`; legendas/transcrição ficam como meta futura. |
| RNF-27 | Pixel art renderizada **sem blur**: canvas com `image-rendering: pixelated`, escala por fator inteiro (1×, 2×, 3×), texturas com filtro NEAREST. |
| RNF-28 | Funciona atrás de NAT restritivo: servidor TURN (coturn) incluído no deploy. |

---

## 5. Especificação Gráfica — Pixel Art, Tiles e Sprites

Esta seção define **dimensões, formatos e convenções obrigatórias** para todos os assets.
Segue de perto os padrões do Gather Town para compatibilidade conceitual e facilidade de
encontrar/produzir assets.

### 5.1 Fundamentos

| Parâmetro | Valor | Observação |
|---|---|---|
| **Tamanho do tile** | **32×32 px** | Igual ao Gather. Unidade básica do grid do mundo. |
| **Unidade de coordenada** | 1 tile | Posições no protocolo são em tiles (inteiros); o cliente interpola em pixels. |
| **Escala de renderização** | 1×, 1.5×*, 2×, 3× | Zoom padrão 1.5× em telas 1080p (*1.5× só com render em textura 2× reduzida, para não quebrar pixels; preferir inteiros). |
| **Formato de arquivo** | PNG-24 com alfa | Sem JPEG para sprites/tiles. |
| **Filtro de textura** | NEAREST (sem antialiasing) | Configurar no Phaser: `pixelArt: true`. |
| **Paleta de referência** | Livre, mas recomenda-se paletas coesas (ex.: 32–64 cores por tileset) | Tons suaves "aconchegantes" como o Gather: madeira, plantas, tons pastel. |
| **Origem do grid** | Canto superior esquerdo do mapa, x→direita, y→baixo | Convenção do Tiled. |

### 5.2 Avatar — dimensões e spritesheet

O avatar segue o padrão do Gather: **ocupa 1 tile de chão (32×32), mas é desenhado com
2 tiles de altura**, criando a perspectiva "top-down 3/4" típica.

| Parâmetro | Valor |
|---|---|
| **Frame do avatar** | **32×64 px** (largura × altura) |
| **Footprint (colisão)** | 32×32 px — o tile inferior do frame |
| **Âncora de renderização** | Centro-inferior do frame (pé do avatar no centro do tile) |
| **Ordenação (depth)** | `depth = y do pé` — quem está mais "abaixo" no mapa desenha por cima (y-sorting) |

#### Animações obrigatórias (por direção: down, up, left, right)

| Animação | Frames | FPS | Observação |
|---|---|---|---|
| `idle` | 1–2 | 2 | Parado; frame 2 opcional (piscar/respirar). |
| `walk` | 4 | 8–10 | Ciclo: passo-esq → neutro → passo-dir → neutro. |
| `sit` (P1) | 1 por direção | — | Usada em cadeiras. |
| `ghost` (P1) | reutiliza idle/walk com alpha 0.5 | — | Efeito no engine, não no sprite. |

#### Layout do spritesheet do avatar (por camada)

Grade fixa de **frames 32×64**, uma linha por direção, colunas por frame:

```
Colunas →  0      1      2      3      4      5
Linha 0:  idle₁  idle₂  walk₁  walk₂  walk₃  walk₄   (direção: DOWN)
Linha 1:  idle₁  idle₂  walk₁  walk₂  walk₃  walk₄   (direção: UP)
Linha 2:  idle₁  idle₂  walk₁  walk₂  walk₃  walk₄   (direção: LEFT)
Linha 3:  idle₁  idle₂  walk₁  walk₂  walk₃  walk₄   (direção: RIGHT)
Linha 4:  sit                                        (DOWN,UP,LEFT,RIGHT em colunas 0–3) [P1]
```

→ Arquivo de **192×320 px** (6 colunas × 32, 5 linhas × 64). Se `left` for espelho de `right`,
a linha LEFT pode ser omitida no PNG e espelhada no engine (flag no manifesto da camada).

#### Sistema de camadas do avatar (paper-doll)

O avatar final é a **composição em runtime** de spritesheets alinhados na mesma grade
(todas as camadas usam exatamente o mesmo layout acima, com pixels transparentes fora da parte desenhada):

| Ordem (baixo→cima) | Camada | Exemplos |
|---|---|---|
| 1 | `body` | 5+ tons de pele |
| 2 | `bottom` | calça, saia, shorts |
| 3 | `top` | camiseta, moletom, camisa |
| 4 | `shoes` (P1) | tênis, botas |
| 5 | `hair` | 10+ estilos × cores |
| 6 | `facial` (P1) | óculos, barba |
| 7 | `hat` (P1) | boné, chapéu |
| 8 | `accessory` (P2) | mochila, fone |

Cada item é um PNG independente + entrada num manifesto JSON:

```json
{
  "id": "hair_short_brown",
  "layer": "hair",
  "sheet": "avatars/hair/short_brown.png",
  "mirrorLeftFromRight": true,
  "license": "CC0",
  "author": "..."
}
```

**Fonte de assets iniciais**: produzir set próprio (CC0) OU adaptar bases open source
compatíveis (ex.: personagens 32×64 estilo "Modern Interiors" de LimeZu exigem licença paga —
**não usar**; preferir Kenney (CC0) e encomendar/criar base própria). Regra: nada entra em
`assets/` sem licença registrada no manifesto.

### 5.3 Tilesets de cenário

| Parâmetro | Valor |
|---|---|
| Grid | 32×32 px, sem margem e sem espaçamento (margin=0, spacing=0) |
| Dimensão máxima do PNG | 2048×2048 px |
| Categorias mínimas | pisos (madeira, carpete, grama, calçada), paredes (com autotile de bordas), decoração (plantas, tapetes), móveis (mesas, cadeiras, sofás, estantes), tech (computadores, TVs), exterior (árvores, água) |

- Paredes e objetos altos que o avatar deve poder ficar "atrás" vão em camada **Above**
  (renderizada acima dos avatares) — ver 5.6.
- Objetos maiores que 1 tile (ex.: mesa 2×1, sofá 3×1, árvore 2×3) são desenhados como
  **multi-tile** no tileset ou como **objetos** (imagem única com footprint definido).

### 5.4 Objetos interativos — sprites

| Parâmetro | Valor |
|---|---|
| Dimensões | Múltiplos de 32 px (32×32, 64×32, 32×64, 64×64, 96×64...) |
| Âncora | Centro-inferior |
| Footprint de colisão | Retângulo em tiles definido no manifesto (pode ser menor que o sprite) |
| Estado visual | 2 frames: `normal` e `highlight` (contorno branco/amarelo 1 px) — ou highlight via shader/outline no engine (preferido) |
| Distância de interação | Em tiles (padrão: 1) |

Manifesto de objeto:

```json
{
  "id": "whiteboard_large",
  "sprite": "objects/whiteboard_large.png",
  "size": { "w": 2, "h": 1 },
  "collision": { "x": 0, "y": 0, "w": 2, "h": 1 },
  "anchorAbove": true,
  "interaction": { "type": "iframe", "distance": 2, "defaultUrl": "https://excalidraw.com" }
}
```

### 5.5 Efeitos de tile (camada lógica)

Cada mapa tem uma **grade de efeitos** paralela à grade visual. Um tile pode acumular efeitos
(ex.: spawn dentro de private area). Valores:

| Efeito | Dados extras | Semântica |
|---|---|---|
| `impassable` | — | Bloqueia movimento. |
| `spawn` | `spawnId?` | Ponto de entrada; `spawnId` permite spawns nomeados (destino de portal/convite). |
| `portal` | `targetMap`, `targetX`, `targetY` (ou `targetSpawnId`) | Teleporta ao pisar. |
| `private` | `areaId` (string) | Membros da mesma `areaId` formam um grupo de mídia isolado. |
| `spotlight` | — | Transmite mídia do ocupante para o mapa todo. |

### 5.6 Formato de mapa — convenção Tiled

Mapas são **Tiled JSON (.tmj)**, orientação ortogonal, tiles 32×32. Camadas convencionadas
(nomes exatos):

| Camada Tiled | Tipo | Renderização |
|---|---|---|
| `Ground` | tile layer | Abaixo de tudo (pisos). |
| `Ground2` (opcional) | tile layer | Tapetes, detalhes de chão. |
| `Objects` | tile layer | Móveis/decoração na altura do avatar (participa do y-sorting quando marcado). |
| `Above` | tile layer | Sempre acima dos avatares (topo de paredes, copas de árvores). |
| `Effects` | tile layer (tileset especial invisível) **ou** object layer | Efeitos da seção 5.5, via propriedades customizadas (`effect=portal`, `targetMap=...`). |
| `Interactables` | object layer | Objetos interativos com propriedades (`objectId`, `type`, `url`...). |

O backend **valida e compila** o .tmj para um formato interno compacto
(grade de colisão como bitset, lista de efeitos, lista de objetos) no momento do upload.

### 5.7 UI fora do canvas

A interface (barras, painéis de vídeo, chat, modais) é **HTML/CSS normal por cima do canvas**
— não é pixel art — com tipografia legível (ex.: Inter) e, opcionalmente, detalhes com fonte
pixel (ex.: "Press Start 2P") apenas em títulos decorativos. Vídeos dos participantes em
cartões arredondados no topo, como no Gather.

---

## 6. Arquitetura e Stack Tecnológica

### 6.1 Visão geral

```
                        ┌────────────────────────────────────────────┐
                        │                 Navegador                  │
                        │  React (UI) + Phaser 3 (mundo, canvas)     │
                        │  livekit-client (WebRTC)                   │
                        └──────┬──────────────┬──────────────┬───────┘
                       HTTPS   │        WSS   │       WebRTC │(SRTP)
                               ▼              ▼              ▼
┌──────────┐          ┌─────────────────────────────┐   ┌──────────┐
│  Caddy / │  ─────▶  │        pixelrooms-server    │   │ LiveKit  │
│  nginx   │          │            (Go)             │   │  (SFU,   │
│ (TLS/CDN)│          │  ┌───────────┬───────────┐  │   │  em Go)  │
└──────────┘          │  │ API REST  │ Game/WS   │  │   └────┬─────┘
                      │  │ (auth,    │ (salas,   │  │        │
                      │  │  spaces,  │  movimento│  │   ┌────▼─────┐
                      │  │  mapas)   │  chat,    │  │   │ coturn   │
                      │  └─────┬─────┤  presença)│  │   │ (TURN)   │
                      │        │     └─────┬─────┘  │   └──────────┘
                      └────────┼───────────┼────────┘
                               ▼           ▼
                        ┌──────────┐  ┌─────────┐
                        │ Postgres │  │  Redis  │
                        │ (dados)  │  │ (pub/sub│
                        └──────────┘  │  cache) │
                                      └─────────┘
```

**Decisão-chave**: a mídia (vídeo/áudio/tela) **não passa pelo game server**. O game server
em Go é o cérebro autoritativo (posições, proximidade, áreas, permissões) e **comanda o SFU**:
calcula quem deve ouvir quem e atualiza subscriptions/permissões no LiveKit via API de admin.

### 6.2 Backend — Go

| Componente | Escolha | Justificativa |
|---|---|---|
| Linguagem | **Go 1.24+** | Requisito do projeto; excelente para servidores concorrentes (goroutines por sala/conexão). |
| Router HTTP | `net/http` + `chi` | Leve, idiomático, middlewares maduros. |
| WebSocket | `github.com/coder/websocket` | Mantido, API limpa com context. |
| Serialização do jogo | **Protobuf** (`google.golang.org/protobuf`) sobre WS binário | Mensagens de movimento compactas (RNF-03); schema versionado compartilhado com o front via `protobuf-es`. |
| SFU WebRTC | **LiveKit (self-hosted)** + `livekit/server-sdk-go` | Open source (Apache-2.0), escrito em Go, resolve simulcast/reconexão/escala; controlado por tokens JWT e API de admin. Alternativa futura: SFU própria com Pion. |
| Banco | **PostgreSQL 16** + `pgx` + migrations com `goose` | Confiável; JSONB para mapas/manifestos. |
| Cache/pub-sub | **Redis 7** (`go-redis`) | Presença global, rate limit, eventos entre nós (P1 — nó único no MVP não depende dele). |
| Auth | JWT (`golang-jwt`), Argon2id (`x/crypto/argon2`) | Padrões estabelecidos. |
| Config | env vars + `caarlos0/env` | RNF-20. |
| Logs/métricas | `log/slog` + `prometheus/client_golang` | RNF-23. |
| Testes | `testing` + `testify`; testes de sala com clientes WS simulados | RNF-22. |

#### Modelo de concorrência do game server

- **1 goroutine por sala (mapa ativo)** rodando o loop de simulação a 20 Hz:
  recebe intenções de movimento por channel, valida colisões, atualiza posições,
  recalcula grupos de proximidade/área, difunde snapshot/deltas.
- **2 goroutines por conexão** (read pump / write pump) com buffers e desconexão de
  clientes lentos (backpressure).
- Estado da sala **só é tocado pela goroutine da sala** (sem mutex no hot path).
- Recalcular proximidade: a cada tile de movimento, não a cada tick (posições intermediárias
  são interpolação visual).

### 6.3 Frontend

| Componente | Escolha | Justificativa |
|---|---|---|
| Engine do mundo | **Phaser 3** | Framework 2D maduro, suporte nativo a tilemaps do Tiled, spritesheets, `pixelArt: true`. |
| UI | **React 18 + TypeScript** | Painéis de vídeo, chat, modais, editor — DOM por cima do canvas. |
| Estado | Zustand | Simples, sem boilerplate. |
| Build | Vite | Rápido, padrão atual. |
| WebRTC | `livekit-client` | Par do SFU escolhido. |
| Protocolo | `@bufbuild/protobuf` (protobuf-es) | Mesmo schema `.proto` do backend, gerado no CI. |
| Estilo | Tailwind CSS | Produtividade na UI. |

O projeto de referência **WorkAdventure** (AGPL) valida essa arquitetura (Phaser + WS + SFU),
mas o PixelRooms **não copia código dele** (AGPL é incompatível com MIT) — serve apenas como
prova de conceito da abordagem.

### 6.4 Infraestrutura

| Componente | Escolha |
|---|---|
| Proxy/TLS | Caddy (TLS automático) |
| TURN | coturn |
| Containers | Docker + docker-compose (deploy padrão); Helm chart (P2) |
| CI | GitHub Actions: lint → test → build → publicar imagens |
| Assets estáticos | Servidos pelo próprio backend com cache headers; CDN opcional |

---

## 7. Protocolo de Comunicação em Tempo Real

WebSocket binário, mensagens Protobuf com envelope:

```proto
// proto/pixelrooms/v1/messages.proto
message ClientMessage {
  uint32 seq = 1;
  oneof payload {
    JoinRequest join = 10;        // token, spaceSlug, mapId?
    MoveIntent move = 11;         // direção OU tile alvo (x, y uint32)
    Interact interact = 12;       // objectId
    ChatSend chat = 13;           // scope (NEARBY|MAP|SPACE|DM), texto, targetUserId?
    EmoteSet emote = 14;          // emoteId (0 = limpar)
    GhostSet ghost = 15;          // on/off
    Ping ping = 16;
  }
}

message ServerMessage {
  oneof payload {
    JoinAck join_ack = 10;        // seu playerId, estado completo da sala, versão do mapa
    PlayerJoined player_joined = 11;
    PlayerLeft player_left = 12;
    MovementDelta movement = 13;  // lote por tick: [(playerId, x, y, dir, moving)]
    Teleport teleport = 14;       // você ou outro (portal/spawn)
    MediaGroups media = 15;       // grupos de mídia atuais + tokens LiveKit quando mudam
    ChatMessage chat = 16;
    EmoteUpdate emote = 17;
    ObjectHighlight highlight = 18;
    ModerationAction moderation = 19; // kicked, banned, muted
    MapUpdated map_updated = 20;  // editor ao vivo (P2)
    Error error = 98;
    Pong pong = 99;
  }
}
```

Regras:

- **Servidor autoritativo**: `MoveIntent` é pedido; a posição válida volta em `MovementDelta`.
  Cliente faz *client-side prediction* e reconcilia se o servidor divergir.
- `MovementDelta` é **agregado por tick** (1 mensagem com todos que se moveram), não 1 por jogador.
- **Mídia**: quando o servidor recalcula grupos (proximidade/área/spotlight), envia `MediaGroups`;
  o cliente conecta/desconecta tracks no LiveKit conforme instruído. O servidor também aplica
  as permissões no lado do SFU (defesa em profundidade — RNF-12).
- Heartbeat ping/pong a cada 15 s; sem pong em 45 s ⇒ desconexão e `PlayerLeft`.

API REST (prefixo `/api/v1`): auth (`/auth/register|login|refresh|guest`), spaces (CRUD,
membros, papéis, bans), maps (CRUD, upload .tmj, publicação), assets (upload de tileset/sprite),
users (perfil, avatar). Documentada com OpenAPI em `docs/api.yaml`.

---

## 8. Modelo de Dados

Tabelas principais (PostgreSQL):

```sql
users        (id uuid PK, email unique NULL para guest, password_hash, display_name,
              avatar jsonb,          -- {body:"body_03", hair:"hair_short_brown", top:"..."}
              is_guest bool, created_at, deleted_at)

spaces       (id uuid PK, slug unique, name, owner_id FK users,
              access text,           -- public | password | members
              password_hash NULL, capacity int NULL, default_map_id FK,
              settings jsonb,        -- raio de proximidade, allowlist de iframes, retenção de chat
              created_at, archived_at)

space_members(space_id FK, user_id FK, role text,  -- owner|admin|builder|moderator|member
              PRIMARY KEY (space_id, user_id), joined_at)

space_bans   (space_id FK, user_id FK NULL, ip_hash text NULL, reason, banned_by, created_at)

maps         (id uuid PK, space_id FK, name, version int,
              tmj jsonb,             -- fonte Tiled original
              compiled jsonb,        -- formato interno: colisão, efeitos, spawns, portais
              width int, height int, created_at, updated_at)

map_objects  (id uuid PK, map_id FK, object_type text, x int, y int,
              sprite text, config jsonb)  -- url do iframe, vídeo, texto da nota...

assets       (id uuid PK, space_id FK NULL, -- NULL = asset global embutido
              kind text,             -- tileset | avatar_layer | object_sprite
              path text, license text, author text, meta jsonb)

chat_messages(id bigserial PK, space_id FK, map_id NULL, scope text,
              sender_id FK, target_user_id NULL, body text, created_at)
              -- particionada por mês; retenção configurável
```

**Estado volátil (memória do game server, nunca no banco)**: posição/direção de cada jogador,
grupos de mídia ativos, emotes, ocupação de spotlight. Redis (P1) guarda apenas presença
global (`user → nó/sala`) para roteamento entre nós.

---

## 9. Estrutura de Diretórios do Monorepo

```
pixelrooms/
├── ESPECIFICACAO.md            # este documento
├── README.md
├── LICENSE                     # MIT
├── Makefile                    # atalhos: dev-infra, backend, frontend, test, lint, proto
├── docker-compose.yml          # dev: postgres, redis (futuro: livekit, coturn, caddy, imagens de prod)
├── .env.example
├── .github/workflows/ci.yml
├── proto/
│   └── pixelrooms/v1/messages.proto
├── backend/                    # servidor Go (módulo go)
│   ├── cmd/pixelrooms/main.go
│   ├── internal/
│   │   ├── api/                # handlers REST (auth, spaces, maps, assets) + health
│   │   ├── auth/               # JWT, Argon2id, middleware
│   │   ├── game/               # núcleo: Room (loop 20Hz), Player, colisão,
│   │   │   │                   #   proximidade, áreas, portais, spotlight
│   │   │   ├── room.go
│   │   │   ├── movement.go
│   │   │   ├── proximity.go
│   │   │   └── effects.go
│   │   ├── ws/                 # upgrade, read/write pumps, codec protobuf
│   │   ├── media/              # integração LiveKit (tokens, grupos, permissões)
│   │   ├── maps/               # parser/validador/compilador de .tmj
│   │   ├── store/              # pgx, queries
│   │   └── config/             # env vars PIXELROOMS_*
│   └── migrations/             # SQL versionado (goose)
├── frontend/                   # cliente web TS (Vite)
│   ├── src/
│   │   ├── game/               # Phaser: cenas, avatar composto, tilemap,
│   │   │   │                   #   predição/interpolação, y-sorting
│   │   ├── net/                # cliente WS + protobuf gerado
│   │   ├── media/              # livekit-client, fade por distância
│   │   ├── ui/                 # React: vídeos, chat, participantes, editor,
│   │   │                       #   onboarding, painéis de admin
│   │   └── state/              # Zustand stores
│   └── vite.config.ts
├── assets/                     # assets embutidos, todos com licença no manifesto
│   ├── avatars/{body,hair,top,bottom}/ + manifest.json
│   ├── tilesets/ + manifest.json
│   ├── objects/ + manifest.json
│   └── maps/templates/*.tmj
└── docs/
    ├── self-hosting.md
    ├── protocol.md
    ├── map-format.md           # convenções Tiled (seção 5.6 expandida)
    ├── asset-guide.md          # como criar sprites/tilesets compatíveis (seção 5)
    └── api.yaml                # OpenAPI
```

---

## 10. Roadmap de Implementação

### Fase 0 — Fundações
Monorepo, CI, docker-compose de dev, schema protobuf, migrations iniciais,
auth (registro/login/guest/JWT), CRUD de space.

### Fase 1 — Mundo andável (marco: "andar juntos")
Compilador de .tmj → formato interno; game server com Room/loop 20 Hz, colisão,
spawn; cliente Phaser renderizando mapa template + avatar de camada única;
movimento com predição + interpolação; y-sorting; presença (join/leave, lista online).

### Fase 2 — MVP de mídia (marco: "conversar por proximidade")
LiveKit no compose; cálculo de grupos por proximidade no servidor; tokens e
subscriptions dirigidos pelo servidor; fade por distância; áreas privadas;
controles de mic/câmera + tela de teste; portais entre mapas.

### Fase 3 — MVP social (marco: usável como escritório de verdade)
Chat (Nearby/Map), avatar por camadas com editor, emotes, objetos interativos
(iframe, imagem, nota) com highlight e tecla X, moderação básica (kick/ban/papéis),
onboarding completo. **⇒ Release 0.1.0 público.**

### Fase 4 — Paridade Gather essencial
Spotlight, screen share, DM + chat Space, ghost mode, clique-para-andar (A*),
sit, quadro branco (Excalidraw), status/mute forçado, editor de mapas visual
(tiles + efeitos + objetos), upload de tilesets, i18n.

### Fase 5 — Escala e ecossistema
Redis pub/sub multi-nó, culling por viewport, follow/locate, minimapa,
objetos com estado sincronizado, webhooks/plugins, edição de mapa ao vivo,
Helm chart, API pública estável.

Cada fase termina com testes cobrindo a lógica nova e documentação atualizada em `docs/`.

---

## 11. Glossário

| Termo | Definição |
|---|---|
| **SFU** | Selective Forwarding Unit — servidor que recebe 1 stream de cada participante e encaminha seletivamente aos demais (escala melhor que mesh P2P). |
| **Servidor autoritativo** | O servidor é a única fonte de verdade do estado do jogo; clientes enviam intenções e renderizam o que o servidor confirma. |
| **Client-side prediction** | O cliente move o próprio avatar imediatamente ao input e corrige depois se o servidor discordar, escondendo a latência. |
| **Interpolação** | Suavizar visualmente a posição dos outros jogadores entre atualizações discretas do servidor. |
| **Tick** | Iteração do loop de simulação do servidor (20 Hz = a cada 50 ms). |
| **Tile** | Célula de 32×32 px do grid do mundo. |
| **Tileset** | Imagem PNG com tiles em grade, referenciada pelos mapas. |
| **Spritesheet** | Imagem PNG com os frames de animação de um sprite em grade. |
| **Paper-doll** | Técnica de compor o avatar por camadas independentes (corpo, cabelo, roupa) alinhadas na mesma grade de frames. |
| **Footprint** | Área de colisão em tiles que um avatar/objeto ocupa no chão. |
| **Y-sorting** | Ordenar a renderização pela coordenada Y do pé, para objetos/avatares mais ao sul cobrirem os mais ao norte. |
| **Tiled** | Editor de mapas open source (mapeditor.org); exporta .tmj (JSON). |
| **TURN** | Servidor relay para WebRTC quando NAT/firewall impede conexão direta com o SFU. |
| **.tmj** | Formato JSON de mapa do Tiled. |

---

*Versão 1.0 — 2026-07-01. Este documento deve ser atualizado sempre que uma decisão de
arquitetura ou requisito mudar; ele é a referência primária para a implementação.*
