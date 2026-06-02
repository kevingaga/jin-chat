# JIN_Chat — Plugin Chat en ligne pour RPG Maker MV

> Chat en temps réel intégré dans JIN, style plugin RPG Maker — un seul fichier à installer.

---

## Ce que ça fait

Un bouton 💬 apparaît en bas à gauche de l'écran de jeu.

- **3 canaux** : 🌍 Global (tout le monde) · 📍 Zone (même carte) · 💰 Commerce
- **Historique** des 50 derniers messages rechargé à la connexion
- **Compteur** de joueurs connectés en temps réel
- **Nom du personnage RMMV** utilisé automatiquement comme pseudo
- **Pas de compte**, pas de mot de passe — ça se connecte tout seul

---

## Déploiement — 3 étapes

### ÉTAPE 1 — Lancer le serveur en ligne (une seule fois)

Le jeu est hébergé sur Netlify (fichiers statiques uniquement).  
Le chat a besoin d'un petit serveur séparé pour relayer les messages.

---

#### Option gratuite — Render.com (recommandée)

> Coût : **0 €/mois**. Pas de carte bancaire requise.

1. Mettre le dossier `chat-poc/server/` dans un dépôt GitHub (ou push ce repo entier)
2. Créer un compte sur [render.com](https://render.com) avec GitHub
3. **New > Web Service** → sélectionner le dépôt
4. Render détecte le fichier `render.yaml` automatiquement
5. Cliquer **Create Web Service** → l'URL ressemble à :  
   `https://jin-chat-xxxx.onrender.com`
6. Vérifier que ça marche :  
   Ouvrir `https://jin-chat-xxxx.onrender.com/health` → doit afficher `{"status":"ok"}`

> **Limitation** : le serveur "dort" après 15 min sans connexion (premier joueur attend ~30s).  
> **Pour éviter ça gratuitement** : créer un compte [UptimeRobot](https://uptimerobot.com),  
> ajouter un moniteur HTTP sur `/health` toutes les **5 minutes** → serveur toujours éveillé.

---

#### Option payante — Railway (déjà configuré)

Le fichier `railway.toml` est déjà en place. Si tu as déjà un projet Railway actif, ça marche directement.  
Coût : 5$/mois minimum depuis 2024.

---

### ÉTAPE 2 — Installer le plugin dans RPG Maker MV

1. Copier **`plugin/JIN_Chat.js`** dans le dossier `js/` de ton projet RPG Maker MV
2. Ouvrir **RPG Maker MV > Plugin Manager**
3. Double-cliquer sur un emplacement libre → chercher `JIN_Chat`
4. L'ajouter **en dernier dans la liste** (important)
5. Renseigner le paramètre **SERVER_URL** :  
   `https://jin-chat-xxxx.onrender.com`  
   *(l'URL de ton serveur Render ou Railway)*
6. Fermer le Plugin Manager, sauvegarder

---

### ÉTAPE 3 — Redéployer sur Netlify

Redéploie ton projet comme d'habitude.  
Le fichier `JIN_Chat.js` dans `js/` sera automatiquement inclus.

---

## Utilisation dans le jeu

| Action | Comment |
|---|---|
| Ouvrir le chat | Cliquer sur **💬** (bas gauche) |
| Changer de canal | Cliquer sur 🌍 / 📍 / 💰 |
| Envoyer | Taper + **Entrée** |
| Fermer | **Échap** ou re-cliquer sur 💬 |

### Depuis un Event RPG Maker

Ajouter une **Commande Plugin** dans n'importe quel event :
```
JIN_Chat open
JIN_Chat close
```

---

## Résumé des coûts

| Service | Coût | Usage |
|---|---|---|
| Netlify | Gratuit | Jeu (déjà en place) |
| Render.com | **Gratuit** | Serveur chat |
| UptimeRobot | **Gratuit** | Garde le serveur éveillé |
| **Total** | **0 €/mois** | |

---

## Structure des fichiers

```
chat-poc/
├── plugin/
│   └── JIN_Chat.js        ← seul fichier à copier dans RMMV
├── server/
│   ├── server.js          ← serveur Node.js à déployer
│   ├── package.json
│   ├── render.yaml        ← config Render.com (gratuit)
│   └── Procfile           ← config Railway
└── client/
    └── index.html         ← page de test locale (dev uniquement)
```

---

## FAQ

**Le chat ne s'affiche pas ?**  
→ Vérifier que `JIN_Chat.js` est dans `js/` ET activé dans le Plugin Manager.

**"Pas connecté" affiché dans le chat ?**  
→ Le serveur est peut-être en train de se réveiller (Render free, ~30s). Patienter et réessayer.

**Messages non reçus en Zone ?**  
→ Le canal Zone ne fonctionne que si plusieurs joueurs sont sur la **même carte** au même moment.

**Le nom s'affiche "Joueur" ?**  
→ Normal si le jeu démarre sans Actor actif (menu principal). Correct dès que le personnage est chargé.

---

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
