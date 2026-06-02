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
│  + JIN_Chat overlay     │                         │  Railway / Render   │
└─────────────────────────┘                         └─────────────────────┘
```

---

## Structure du projet

```
chat-poc/
├── client/
│   ├── index.html          ← Page de test simulant le canvas RPG Maker (816×624)
│   ├── chat-overlay.css    ← Styles du chat (thème JIN/Dofus)
│   └── chat-overlay.js     ← Widget chat autonome (vanilla JS, zéro dépendance front)
├── server/
│   ├── server.js           ← Serveur Node.js + Socket.io
│   └── package.json
└── plugin/
    └── JIN_Chat_Plugin.js  ← Plugin RPG Maker MV (intégration finale dans le jeu)
```

---

## Démarrage rapide

### 1. Lancer le serveur

```bash
cd server
npm install
npm run dev       # nodemon (rechargement auto)
# ou
npm start         # node simple
```

Le serveur écoute sur **http://localhost:3001**.

### 2. Ouvrir le client de test

Ouvrir `client/index.html` dans un navigateur.  
> Note : certains navigateurs bloquent les requêtes depuis `file://`. Utiliser un serveur local :

```bash
# n'importe lequel de ces deux
npx serve client
npx http-server client -p 8080
```

Puis naviguer sur `http://localhost:8080`.

### 3. Tester le chat

1. Entrer un pseudo dans le prompt qui s'affiche
2. Taper un message + Entrée
3. Ouvrir un second onglet sur la même URL → les messages s'affichent en temps réel

---

## Architecture technique

### Serveur (`server/server.js`)

| Événement Socket.io | Sens | Description |
|---|---|---|
| `chat:send` | client → serveur | Envoi d'un message `{ name, text, map }` |
| `chat:message` | serveur → tous | Broadcast du message enrichi |
| `chat:history` | serveur → nouveau client | 50 derniers messages à la connexion |
| `chat:players` | serveur → tous | Nombre de joueurs connectés |

Messages limités à 200 caractères. Noms limités à 24 caractères.  
Historique en mémoire (perdu au redémarrage) — pas de base de données pour ce POC.

### Client (`client/chat-overlay.js`)

Widget autonome, zéro framework, exposé via `window.JinChat` :

```js
JinChat.init({
  serverUrl:  'http://localhost:3001',
  playerName: 'Nordine Ateur',       // null = affiche un prompt de pseudo
  getMapName: function () { return 'Forêt des Débuts'; }
});

JinChat.open();
JinChat.close();
JinChat.toggle();
```

**Raccourcis clavier :**
- `Entrée` (chat fermé) → ouvre le chat et focus le champ
- `Entrée` (chat ouvert) → envoie le message
- `Échap` → ferme le chat

---

## Intégration dans RPG Maker MV

Voir `plugin/JIN_Chat_Plugin.js` — plugin RMMV prêt à copier dans `js/`.

**Étapes :**

1. Copier `JIN_Chat_Plugin.js`, `chat-overlay.css` et `chat-overlay.js` dans le dossier `js/` du projet RPG Maker
2. Dans RPG Maker MV → Plugin Manager → ajouter `JIN_Chat` en **dernier**
3. Renseigner le paramètre `SERVER_URL` avec l'URL du serveur déployé
4. Déployer et tester

Le plugin :
- Récupère le nom du joueur via `$gameActors.actor(1).name()`
- Récupère le nom de la carte via `$gameMap.displayName()`
- Injecte l'overlay sur le canvas au démarrage de `Scene_Map`
- Expose les commandes plugin `JIN_Chat open` / `JIN_Chat close`

---

## Déploiement du serveur

Le serveur est un simple processus Node.js. Hébergements recommandés (tous avec free tier) :

| Service | Commande de déploiement |
|---|---|
| [Railway](https://railway.app) | `railway up` depuis `server/` |
| [Render](https://render.com) | Pointer sur ce repo, build: `npm install`, start: `node server.js` |
| [Fly.io](https://fly.io) | `fly launch` depuis `server/` |

Après déploiement, mettre à jour `SERVER_URL` dans le Plugin Manager RMMV.

---

## Ce qui est en place / Ce qui reste à faire

| | Statut |
|---|---|
| Serveur WebSocket minimal | ✅ |
| Widget chat HTML/CSS/JS autonome | ✅ |
| Page de test simulant RPG Maker | ✅ |
| Plugin RPG Maker MV (stub intégration) | ✅ |
| Historique en mémoire (50 messages) | ✅ |
| Thème visuel JIN/Dofus | ✅ |
| Authentification joueur | ❌ à définir |
| Persistance messages (base de données) | ❌ hors scope POC |
| Canaux multiples (global / zone / guilde) | ❌ à définir |
| Modération (mute, ban, filtre spam) | ❌ hors scope POC |

---

## Questions ouvertes avant intégration finale

1. **Identité joueur** : le nom RPG Maker suffit-il, ou faut-il un pseudo distinct du nom de personnage ?
2. **Canaux** : un seul canal global, ou plusieurs (global, zone actuelle, guilde) ?
3. **Persistance** : les messages doivent-ils survivre à un redémarrage serveur ? (nécessite une DB)
4. **Hébergement** : qui déploie et maintient le serveur backend ? (Euphonik ou externe)
5. **Touche de toggle** : `Entrée` peut-il entrer en conflit avec des actions RPG Maker existantes ?
