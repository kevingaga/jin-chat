//=============================================================================
// JIN_Chat
// Chat en ligne — overlay HTML via WebSocket (Socket.io)
//=============================================================================
// Auteur   : Euphonik / Gwen
// Version  : 0.1.0-poc
// Dépend   : socket.io-client (injecté dynamiquement)
//=============================================================================
//
// INSTALLATION
// ─────────────────────────────────────────────────────────────────────────────
// 1. Copier ce fichier dans le dossier js/ du projet RPG Maker MV.
// 2. Dans RPG Maker MV > Plugin Manager, ajouter JIN_Chat en dernier (ordre d'appel).
// 3. Renseigner le paramètre SERVER_URL avec l'URL du serveur déployé.
//    Exemple : wss://jin-chat.railway.app
// 4. Déployer le serveur (dossier chat-poc/server/) sur Railway, Render ou Fly.io.
//
// PARAMÈTRES PLUGIN (à configurer dans le Plugin Manager de RMMV)
//   SERVER_URL    — URL du serveur WebSocket (ex: https://jin-chat.railway.app)
//   TOGGLE_KEY    — Touche pour ouvrir/fermer le chat (défaut : "enter")
//   SHOW_MAP_NAME — Afficher le nom de la carte dans les messages (true/false)
//
// UTILISATION EN EVENT/SCRIPT
//   JIN_Chat.open()             // Ouvre le chat depuis un event
//   JIN_Chat.close()            // Ferme le chat
//   JIN_Chat.send("texte")      // Envoie un message programmatiquement
//
//=============================================================================

/*:
 * @plugindesc v0.1 Chat en ligne — overlay HTML WebSocket
 * @author Euphonik / Gwen
 *
 * @param SERVER_URL
 * @text URL du serveur
 * @desc URL du serveur WebSocket (sans slash final)
 * @default https://jin-chat.railway.app
 *
 * @param SHOW_MAP_NAME
 * @text Afficher le nom de la carte
 * @type boolean
 * @default true
 *
 * @help
 * JIN_Chat — Chat en ligne pour RPG Maker MV
 *
 * Ouvre/ferme : touche Entrée quand le chat est fermé
 * Ferme        : Échap depuis le champ de saisie
 *
 * Commandes plugin (dans les events) :
 *   JIN_Chat open
 *   JIN_Chat close
 */

var JIN_Chat = JIN_Chat || {};

(function () {
  'use strict';

  // ── Paramètres plugin ──────────────────────────────────────────────────────
  var _params = PluginManager.parameters('JIN_Chat');
  var SERVER_URL    = _params['SERVER_URL']    || 'http://localhost:3001';
  var SHOW_MAP_NAME = _params['SHOW_MAP_NAME'] !== 'false';

  var SOCKETIO_CDN  = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
  var OVERLAY_CSS   = 'js/JIN_Chat_overlay.css';
  var OVERLAY_JS    = 'js/JIN_Chat_overlay.js';

  var _initialized  = false;

  // ── Helpers : injection dynamique de ressources ────────────────────────────
  function _injectCSS(href) {
    var link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  function _injectScript(src, onload) {
    var s = document.createElement('script');
    s.src = src;
    s.onload = onload || null;
    document.head.appendChild(s);
  }

  // ── Récupère le nom de la carte depuis RPG Maker ───────────────────────────
  function _getMapName() {
    if (!SHOW_MAP_NAME) return null;
    try {
      return $gameMap && $gameMap.displayName ? $gameMap.displayName() : null;
    } catch (e) { return null; }
  }

  // ── Récupère le nom du joueur depuis RPG Maker ─────────────────────────────
  function _getPlayerName() {
    try {
      return $gameActors.actor(1).name();
    } catch (e) { return 'Joueur'; }
  }

  // ── Initialisation au démarrage de Scene_Map ──────────────────────────────
  function _initChat() {
    if (_initialized) return;
    _initialized = true;

    // 1. Créer le point de montage dans le body (sur le canvas PIXI, z-index géré en CSS)
    var root = document.getElementById('jin-chat-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'jin-chat-root';
      // Positionner par rapport au canvas RPG Maker
      root.style.position = 'absolute';
      root.style.left     = '0';
      root.style.bottom   = '0';
      // Le canvas PIXI est un enfant de #game, on cible ce parent
      var gameEl = document.getElementById('game') || document.body;
      gameEl.style.position = gameEl.style.position || 'relative';
      gameEl.appendChild(root);
    }

    // 2. Injecter CSS + socket.io + overlay JS dans l'ordre
    _injectCSS(OVERLAY_CSS);
    _injectScript(SOCKETIO_CDN, function () {
      _injectScript(OVERLAY_JS, function () {
        JinChat.init({
          serverUrl:   SERVER_URL,
          playerName:  _getPlayerName(),
          getMapName:  _getMapName
        });

        // Exposer sur JIN_Chat pour les appels depuis les events plugin
        JIN_Chat.open  = JinChat.open.bind(JinChat);
        JIN_Chat.close = JinChat.close.bind(JinChat);
        JIN_Chat.send  = JinChat.send.bind(JinChat);
      });
    });
  }

  // ── Hook Scene_Map.prototype.start ────────────────────────────────────────
  var _Scene_Map_start = Scene_Map.prototype.start;
  Scene_Map.prototype.start = function () {
    _Scene_Map_start.call(this);
    _initChat();
  };

  // ── Plugin Command ─────────────────────────────────────────────────────────
  // Usage dans un event : Plugin Command → JIN_Chat open / JIN_Chat close
  var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
  Game_Interpreter.prototype.pluginCommand = function (command, args) {
    _Game_Interpreter_pluginCommand.call(this, command, args);
    if (command !== 'JIN_Chat') return;
    var action = (args[0] || '').toLowerCase();
    if (action === 'open'  && JIN_Chat.open)  JIN_Chat.open();
    if (action === 'close' && JIN_Chat.close) JIN_Chat.close();
  };

})();
