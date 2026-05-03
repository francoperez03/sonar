# Sonar — Demo Script (live, ~3 min)

## Context

Demo en vivo end-to-end para ETHGlobal OpenAgents: arrancamos en la landing, mostramos el problema/approach, clickeamos para entrar a la demo app, ejercitamos las 4 acciones del agente (list / rotate / clone-attack / reset), y abrimos KeeperHub en paralelo para evidenciar el workflow on-chain. El objetivo es que el evaluador vea (a) la narrativa del producto, (b) el sistema reaccionando en vivo, y (c) las pruebas verificables (chain + dashboard de KH).

---

## 0. Pre-flight — antes de salir al aire

### 0.1 Terminales (orden importa)

```bash
# Terminal 1 — operator (puerto 8787)
pnpm --filter @sonar/operator dev

# Terminal 2 — runtime alpha (necesario para rotation real)
RUNTIME_ID=alpha pnpm --filter @sonar/runtime dev

# Terminal 3 — keeperhub poller (puerto 8788, broadcastea on-chain events al operator)
pnpm --filter @sonar/keeperhub dev

# Terminal 4 — ngrok hacia operator
ngrok http --url=christian-actinographic-impliedly.ngrok-free.dev 8787
# Verificá que la URL coincide con la del workflow.json:
#   apps/keeperhub/workflow.json → endpoints

# Terminal 5 — opcional, AXL p2p (si vas a mostrar el toggle)
./infra/axl/start-a.sh   # node A (api 9001, tls 9101)
./infra/axl/start-b.sh   # node B (api 9002, peerea con A)
B_PUB=$(curl -s http://127.0.0.1:9002/topology | python3 -c "import json,sys; print(json.load(sys.stdin)['our_public_key'])")
AXL_DEST_PEER_ID="$B_PUB" node scripts/axl-bridge.mjs
```

### 0.2 Verificación rápida (60 segundos antes de empezar)

```bash
curl -sS -o /dev/null -w "ngrok: %{http_code}\n" \
  https://christian-actinographic-impliedly.ngrok-free.dev/runtimes \
  -H "ngrok-skip-browser-warning: 1"
# esperado: 200
```

Abrí `https://sonar-demo-ui.vercel.app/`. Tiene que mostrar:
- Topbar: `● LIVE  christian-actinographic-…/logs  VIA WS  · last event Xs ago`
- Topbar derecha: `● READY` y `FLEET REGISTRY 0x7edd…b31f`
- Canvas: ALPHA registered con balance, BETA/GAMMA en cualquier estado, GAMMA-CLONE ghost
- Sidebar OPERATOR STREAM: eventos recientes
- Si BETA o GAMMA están `revoked`, **tirá Reset demo desde el chat antes de empezar**.

### 0.3 Tabs del browser (en este orden)

| Tab | URL | Para qué |
|---|---|---|
| 1 | `https://sonar-demo-ui.vercel.app/` (es el deploy de la landing — DemoCtaSection lo expone como "Open the live demo") — **ojo: la landing es otra URL si tenés el split** | Inicio del demo |
| 2 | `https://sonar-demo-ui.vercel.app/` | App live |
| 3 | `https://app.keeperhub.com/workflows/zu25iauu5jkv2bw9xngnl` | Dashboard del workflow KH |
| 4 | `https://sepolia.basescan.org/address/0x7eddfc8953a529ce7ffb35de2030f73aad89b31f` | FleetRegistry contract |

---

## 1. Apertura — landing (~30 s)

**Tab 1 (landing).** Mostrá hero arriba sin scrollear.

> "Sonar es un sistema para rotar credenciales sin que el LLM jamás vea una sola privkey. La promesa la pueden leer arriba: **Rotate keys without trusting the agent**."

Scroll lento hasta `01 / PROBLEM`.

> "El problema. Hoy un agente con secretos en contexto es un riesgo: una línea de log envenenada y la key se va. **OWASP LLM06**. Sonar nunca le muestra una key al LLM."

Scroll a `02 / APPROACH`.

> "Approach. El LLM orquesta toda la rotación: generar wallets, fondearlas, distribuir, y deprecar las viejas on-chain. Pero cada runtime tiene que firmar un challenge antes de recibir nada. Sin firma válida, no hay key. Los clones no pasan."

Scroll a `03 / SEE IT RUN`. Click en **"Open the live demo"**.

---

## 2. Primer vistazo a la demo (~20 s)

**Tab 2 (demo app).** Pausa. Guiá la mirada por el topbar primero.

> "Arriba: a la izquierda el badge me dice que estoy en vivo, conectado al operator vía WebSocket. Puedo cambiar el transport a AXL p2p con un click — ya vamos a probarlo. A la derecha: rotation status, y el contrato de FleetRegistry en Base Sepolia, que es donde se deprecan las wallets viejas."

Hacé click en el chip `0x7edd…b31f` (abre nueva tab).

> "Ahí lo tienen, en basescan."

Volvé a la tab del demo.

> "El canvas: tres runtimes legítimos — alpha, beta, gamma — y un cuarto, gamma-clone, mostrado en sombra. Es la silueta del 'atacante' que vamos a probar. Cada card muestra status, address EVM y balance en vivo."

---

## 3. Beat 1 — listar (~15 s)

En el chat input, click en el chip **"List runtimes"**.

> "Le pido al agente que liste el fleet."

El stream SSE muestra tokens en tiempo real. Esperar el bubble del assistant.

> "Tres runtimes. Alpha registered. Beta y gamma con estado revoked de demos previas — ya vamos a resetear. La info viene del operator, **el LLM nunca tocó una privkey** en este pedido."

---

## 4. Beat 2 — rotar alpha (~40 s)

**Click en el chip "Rotate alpha".**

> "Acá viene lo bueno. Le digo: **rota las claves de alpha**. Esto dispara un workflow en KeeperHub."

Inmediatamente saltá a **Tab 3 (KeeperHub dashboard)**.

> "Mirá: KeeperHub recibió el trigger, está corriendo los nodos del workflow. Generó cuatro nuevas EOAs, las está fondeando con un faucet de Base Sepolia, y ahora va a distribuirlas a los runtimes."

Volvé a **Tab 2 (demo app)** mientras KH trabaja (~10-30 s).

> "En la canvas: alpha pasa de **registered** a **awaiting**. Ven la línea cyan punteada del operator a alpha — es el data packet viajando por el handshake. Alpha firma el challenge con su privkey ed25519, valida identidad, y recibe la nueva wallet EVM."

Esperar a que alpha llegue a `received`. Después scroll del MiniTimeline al pie del canvas:

> "Toda esta secuencia queda en el OPERATOR STREAM y en el mini timeline acá abajo: chips por evento. La nueva address aparece en la card de alpha, y abajo en el ROTATION STATUS del topbar tienen el tx hash de la deprecation con link directo a basescan."

Click en el tx hash chip si está visible → abre BaseScan en nueva tab.

> "Ahí está, on-chain: `WalletsDeprecated` emitida por el FleetRegistry. La rotación cerró. La privkey vieja queda invalidada en el contrato; la nueva nunca pasó por el LLM."

---

## 5. Beat 3 — simular clone attack (~30 s)

Volvé a la tab del demo. **Click en el chip "Simulate clone attack"**.

> "Ahora el escenario que justifica todo el sistema: **un atacante con el binario del runtime alpha pero sin la identidad criptográfica**. Le pido al agente que simule el ataque."

El operator abre una WS real desde sí mismo, como un fake clone con una pubkey ed25519 random. Mirar la canvas:

> "Ven dos cosas: el card de **GAMMA-CLONE** flashea en rojo destructivo — es el ghost que representa 'cualquier intento de clone' en este demo. Y al lado de **alpha** aparece una silueta translúcida con una X — ese es el atacante real, el que el operator detectó y rechazó. Cierre del socket con código `4403 pubkey_mismatch`."

Punto al OPERATOR STREAM en la sidebar:

> "El log lo cuenta: `Clone rejected: alpha presented foreign pubkey; handshake denied`. La protección no es decorativa: el operator chequea la pubkey contra la registrada, y si no coincide, no hay handshake. **Sin firma válida, no hay key**, como decía la landing."

---

## 6. Beat 4 — toggle WS ↔ AXL (~20 s, opcional)

Solo si tenés AXL nodes + bridge corriendo.

**Click en el toggle "AXL"** del topbar.

> "Demostración rápida: el transport. Hasta ahora veníamos del WebSocket centralizado del operator. Click en AXL: ahora el browser polea una mesh peer-to-peer construida sobre **gensyn-ai/axl**. Mismo bus de eventos, transport descentralizado."

El badge debe pasar a `VIA AXL` con accent cyan, y `last event` arrancar a tickear de nuevo.

> "El contrato `ITransport` lo permite: cualquier consumidor que respete la interfaz puede enchufarse. Esto es lo que hace al sistema portable a redes p2p de verdad."

Click de vuelta a `WS` (la animación cinematográfica del EdgePulse se ve mejor en WS por latencia).

---

## 7. Beat 5 — interacción directa en card (~15 s)

> "Y para el evaluador que prefiere clickear sin tipear: cada card es interactiva."

**Click en la card de ALPHA** → aparece el menú flotante.

> "Action menu: rotate, inspect, simulate attack, revoke. Cada item dispara el agente con el prompt apropiado. Cero tipeo, mismo path end-to-end."

Click fuera para cerrar, o ESC.

---

## 8. Cierre + reset (~10 s)

**Click en "Reset demo"**.

> "Reset deja todo limpio para la próxima corrida — los runtimes vuelven a `registered`, la mini timeline se limpia, las wallets se desasignan. El operator no necesita reiniciarse."

Volver a la **tab de la landing** (Tab 1) por simetría.

> "Eso es Sonar: el LLM ve el sistema, mueve las piezas, pero nunca toca una key. **Identity-checked rotation. End-to-end on Base Sepolia. Built in 5 días.**"

Fin.

---

## 9. Plan de recuperación — si algo se rompe en vivo

| Síntoma | Acción inmediata |
|---|---|
| Badge muestra `OFFLINE` | Verificar que ngrok sigue arriba (`curl -sS -o /dev/null -w "%{http_code}" https://...trycloudflare.com/runtimes`). Si cayó, reiniciar tunnel; el badge reconecta solo en <30s. |
| `Rotate alpha` se queda en `awaiting` >60s | Significa que el runtime alpha no está corriendo o no ackea. Tirar otra rotation contra **beta** o **gamma** mientras se diagnostica. Como last resort: `Reset demo` y arrancar de cero. |
| `Simulate clone attack` no flashea | El operator no está al día con el código nuevo (commit `cf39652+`). En el terminal del operator: ver que el log diga `operator_listening port=8787`. Si no, restart. |
| KeeperHub workflow falla con 5xx | Verificar `apps/keeperhub/workflow.json` apunta al ngrok URL actual. Si cambió, `pnpm --filter @sonar/keeperhub publish:workflow`. |
| El stream de tokens del agente se cuelga | Probable hit de rate limit de Anthropic Haiku. Esperar 5s y retry. |
| AXL toggle muestra `OFFLINE` al cambiar | El bridge `scripts/axl-bridge.mjs` se cayó. En el terminal del bridge ver el último log; restart. |

**Regla de oro:** si un beat se rompe, **continúa narrando el siguiente**. El stack es resiliente: la siguiente rotación reseguramente funciona aunque la anterior haya fallado.

---

## 10. Post-demo (opcional, para Q&A)

Bullets para tener listos en caso de preguntas:

- **¿Por qué el LLM no ve las privkeys?** Por construcción: las privkeys viven en el `PrivkeyVault` en memoria del operator (TTL 10min), nunca llegan al MCP, nunca aparecen en el SSE del agente, nunca quedan en el LogBus. La función `toJSON()` del vault tira excepción para que ningún `JSON.stringify` accidental las filtre.
- **¿Y si se cae el operator mid-rotation?** El TTL del vault evicta a los 10min. La rotation queda incompleta on-chain (las nuevas wallets minted, las viejas no deprecadas). KeeperHub re-tira el workflow al detectar que el `/rotation/distribute` no devolvió 200.
- **¿Por qué AXL?** Para no tener un único WS centralizado entre operator y consumidores. La interfaz `ITransport` permite swap; AXL es la implementación p2p de referencia. WebSocket sigue siendo el default por latencia (250ms vs sub-ms).
- **¿Y la wallet del operator?** El operator no firma transacciones on-chain; KeeperHub lo hace. El operator solo orquesta. La address que aparece en `FLEET REGISTRY` chip es del contrato, no de un EOA.
- **Coverage de tests.** 259/259 verde across shared/keeperhub/demo-ui/runtime/mcp/operator. Los 6 tools del agente cubiertos por tests unitarios + smoke E2E con Playwright.
