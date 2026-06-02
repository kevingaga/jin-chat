# JIN Chat — POC

> Overlay chat en temps réel pour JIN (RPG Maker MV) — proof of concept avant intégration dans le projet principal.

---

## Vue d'ensemble

JIN tourne dans le navigateur via RPG Maker MV + PixiJS, hébergé statiquement sur Netlify.  
Netlify ne peut pas héberger de backend — le chat nécessite un serveur WebSocket séparé.

```
┌─────────────────────────┐       WebSocket        ┌─────────────────────┐
│  Navigateur             │  ◄──────────────────►  │  Serveur Node.js    │
│  RPG Maker MV (canvas)  │      Socket.io          │  socket.io          │
│  + JIN_Chat overlay     │                         │  Railway / machine  │
└─────────────────────────┘                         └─────────────────────┘
```

---

## Choix techniques arrêtés

| Point | Décision |
|---|---|
| Identité joueur | Nom du personnage RPG Maker (`$gameActors.actor(1).name()`) |
| Canaux | **3 canaux style Dofus** — Général [G], Zone [Z], Commerce [C] |
| Persistance | **En mémoire** (50 messages) — reset au redémarrage serveur, c'est OK |
| Hébergement | **Machine locale** pour l'instant, Railway/Render envisageable ensuite |

---

## Canaux (style Dofus)

| Canal | Touche | Couleur | Portée |
|---|---|---|---|
| Général | `G` | Orange | Tous les joueurs connectés |
| Zone | `Z` | Bleu | Joueurs sur la même carte uniquement |
| Commerce | `C` | Vert | Tous les joueurs connectés |

**Utilisation :**
- Cliquer sur `[G]` dans la barre de saisie pour cycler entre les canaux
- Préfixes : `/g message`, `/z message`, `/c message` — override ponctuel
- Taper `/z` seul → bascule le canal actif sur Zone

---

## Structure du projet

```
chat-poc/
├── client/
│   ├── index.html          ← Page de test simulant le canvas RPG Maker (816×624)
│   ├── chat-overlay.css    ← Styles (thème JIN/Dofus, variables CSS par canal)
│   └── chat-overlay.js     ← Widget autonome vanilla JS — API JinChat.*
├── server/
│   ├── server.js           ← Node.js + Socket.io, rooms par carte pour la Zone
│   └── package.json
└── plugin/
    └── JIN_Chat_Plugin.js  ← Plugin RMMV prêt à intégrer dans js/
```

---

## Démarrage rapide

### 1. Lancer le serveur

```bash
cd server
npm install
npm run dev       # nodemon — rechargement auto
# ou
npm start
```

Serveur sur **http://localhost:3001**.

### 2. Ouvrir le client de test

```bash
# Depuis la racine du projet
npx serve client
# ou
npx http-server client -p 8080
```

Ouvrir **http://localhost:8080** dans le navigateur.

> Note : ouvrir plusieurs onglets pour tester le chat multi-joueur en local.

### 3. Tester les canaux

1. Entrer un pseudo dans le prompt
2. `[G]` → message visible par tous
3. `/z message` → visible uniquement par les joueurs sur la même carte
4. Ouvrir un second onglet avec un pseudo différent → vérifier la réception

---

## Architecture

### Serveur (`server/server.js`)

| Événement | Sens | Description |
|---|---|---|
| `chat:location` | client → serveur | Déclare la carte courante (rejoint une room Socket.io) |
| `chat:send` | client → serveur | `{ name, text, map, channel }` |
| `chat:message` | serveur → clients | Broadcast (global/trade = tous, zone = même carte) |
| `chat:history` | serveur → nouveau client | 50 derniers messages global/commerce |
| `chat:players` | serveur → tous | Nombre de joueurs connectés |

Le canal **Zone** utilise les **rooms Socket.io** (`map:NomDeLaCarte`) — le serveur n'a pas besoin de logique custom, Socket.io gère la diffusion ciblée.

### Client (`client/chat-overlay.js`)

API exposée via `window.JinChat` :

```js
JinChat.init({
  serverUrl:  'http://localhost:3001',
  playerName: 'Nordine Ateur', // null → prompt pseudo (mode POC)
  getMapName: function () { return 'Forêt des Débuts'; }
});

JinChat.open();
JinChat.close();
JinChat.toggle();
JinChat.send('texte', 'zone');  // envoi programmatique sur un canal
JinChat.updateMap();            // à appeler après un changement de carte
```

**Raccourcis clavier :**
- `Entrée` (chat fermé) → ouvre et focus le champ
- `Entrée` (chat ouvert) → envoie le message
- `Échap` → ferme le chat
- `/g` `/z` `/c` → change le canal d'envoi

---

## Intégration dans RPG Maker MV

Voir `plugin/JIN_Chat_Plugin.js`.

**Étapes :**
1. Copier `JIN_Chat_Plugin.js`, `chat-overlay.css` et `chat-overlay.js` dans `js/` du projet RPG Maker
2. Plugin Manager → ajouter **JIN_Chat** en dernier
3. Renseigner `SERVER_URL` avec l'URL du serveur
4. Tester en jeu — le plugin hook sur `Scene_Map.start` pour l'init et les changements de carte

---

## Déploiement du serveur

Pour une machine locale (réseau local ou exposition via ngrok) :

```bash
cd server && npm start
# Exposer via ngrok si besoin d'un accès externe pendant le dev
npx ngrok http 3001
```

Pour un hébergement cloud gratuit :

| Service | Notes |
|---|---|
| [Railway](https://railway.app) | `railway up` depuis `server/` — simple |
| [Render](https://render.com) | Pointer sur ce repo, start: `node server.js` |
| [Fly.io](https://fly.io) | Plus de config, meilleure latence EU |

---

## État du projet

| Fonctionnalité | Statut |
|---|---|
| Serveur WebSocket + rooms Socket.io | ✅ |
| 3 canaux Dofus-style (G / Z / C) | ✅ |
| Filtrage d'affichage par canal (onglets) | ✅ |
| Préfixes `/g` `/z` `/c` | ✅ |
| Historique en mémoire (50 msgs) | ✅ |
| Thème visuel JIN/Dofus | ✅ |
| Page de test simulant RPG Maker | ✅ |
| Plugin RMMV (stub intégration) | ✅ |
| Authentification / comptes | ✗ hors scope |
| Persistance base de données | ✗ hors scope |
| Modération | ✗ hors scope |
