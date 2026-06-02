//=============================================================================
// JIN_Chat — v1.0
// Chat en ligne pour RPG Maker MV — Plugin tout-en-un
//=============================================================================
// Auteur   : Euphonik / Gwen
// Version  : 1.0.0
//=============================================================================
//
// ╔══════════════════════════════════════════════════════════════╗
// ║  INSTALLATION — 3 étapes                                    ║
// ╠══════════════════════════════════════════════════════════════╣
// ║  1. Copier JIN_Chat.js dans le dossier js/ de ton projet    ║
// ║  2. Plugin Manager → Ajouter "JIN_Chat" (en dernier)        ║
// ║  3. Renseigner SERVER_URL avec l'URL de ton serveur          ║
// ╚══════════════════════════════════════════════════════════════╝
//
//=============================================================================

/*:
 * @plugindesc v1.0 Chat en ligne — WebSocket (Socket.io) — 3 canaux
 * @author Euphonik / Gwen
 *
 * @param SERVER_URL
 * @text URL du serveur
 * @desc URL complète du serveur chat déployé (sans slash à la fin)
 * @default https://ton-serveur.onrender.com
 *
 * @param SHOW_MAP_NAME
 * @text Afficher la zone dans les messages
 * @type boolean
 * @default true
 *
 * @help
 * ══════════════════════════════════════════════
 *   JIN_Chat v1.0 — Chat en ligne pour RMMV
 * ══════════════════════════════════════════════
 *
 * UTILISATION
 *   → Cliquer sur le bouton 💬 en bas à gauche pour ouvrir/fermer
 *   → Choisir un canal : 🌍 Global | 📍 Zone | 💰 Commerce
 *   → Entrée pour envoyer un message
 *   → Échap pour fermer le chat
 *
 * CANAUX
 *   Global   — Tout le monde voit ces messages
 *   Zone     — Uniquement les joueurs sur la même carte
 *   Commerce — Pour proposer achats/ventes
 *
 * COMMANDES PLUGIN (dans les Events RPG Maker)
 *   JIN_Chat open
 *   JIN_Chat close
 */

var JIN_Chat = JIN_Chat || {};

(function () {
  'use strict';

  // ── Paramètres ──────────────────────────────────────────────────────────────
  var params     = PluginManager.parameters('JIN_Chat');
  var SERVER_URL = (params['SERVER_URL'] || 'http://localhost:3001').replace(/\/+$/, '');
  var SHOW_MAP   = params['SHOW_MAP_NAME'] !== 'false';
  var SOCKET_CDN = 'https://cdn.socket.io/4.7.2/socket.io.min.js';

  var _ready = false;

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function playerName() {
    try { return $gameActors.actor(1).name() || 'Joueur'; }
    catch (e) { return 'Joueur'; }
  }

  function mapName() {
    if (!SHOW_MAP) return null;
    try { return ($gameMap && $gameMap.displayName()) || null; }
    catch (e) { return null; }
  }

  function loadScript(src, cb) {
    var s    = document.createElement('script');
    s.src    = src;
    s.onload = cb;
    s.onerror = function () {
      console.error('[JIN_Chat] Impossible de charger socket.io depuis le CDN.');
      UI.addSysMsg('⚠ Connexion impossible — vérifie ta connexion internet.');
    };
    document.head.appendChild(s);
  }

  // ── CSS (injecté une fois dans <head>) ──────────────────────────────────────
  var CSS = [
    '#jin-wrap{',
      'position:fixed;bottom:10px;left:10px;',
      'width:360px;',
      'display:flex;flex-direction:column;gap:6px;',
      'z-index:9999;',
      'font-family:"MS Gothic","PixelMplus10",monospace;',
      'font-size:13px;',
    '}',

    /* ── Bouton toggle ── */
    '#jin-btn{',
      'pointer-events:all;',
      'align-self:flex-start;',
      'width:44px;height:44px;',
      'background:rgba(0,0,0,.82);',
      'border:2px solid #c8a84b;border-radius:50%;',
      'color:#c8a84b;font-size:22px;',
      'cursor:pointer;',
      'display:flex;align-items:center;justify-content:center;',
      'transition:background .2s;',
      'position:relative;',
    '}',
    '#jin-btn:hover{background:rgba(60,50,0,.95);}',

    /* ── Panel ── */
    '#jin-panel{',
      'display:none;',
      'pointer-events:all;',
      'flex-direction:column;',
      'background:rgba(10,8,6,.9);',
      'border:1px solid #c8a84b;border-radius:6px;',
      'overflow:hidden;',
      'box-shadow:0 4px 24px rgba(0,0,0,.7);',
    '}',
    '#jin-panel.open{display:flex;}',

    /* ── Onglets ── */
    '#jin-tabs{',
      'display:flex;',
      'background:rgba(0,0,0,.5);',
      'border-bottom:1px solid #c8a84b33;',
    '}',
    '.jin-tab{',
      'flex:1;padding:7px 0;',
      'background:none;border:none;',
      'color:#7a6a40;font-size:12px;',
      'cursor:pointer;transition:all .15s;',
    '}',
    '.jin-tab:hover{color:#e0c870;}',
    '.jin-tab.active{',
      'color:#c8a84b;',
      'border-bottom:2px solid #c8a84b;',
      'font-weight:bold;',
    '}',

    /* ── Liste des messages ── */
    '#jin-msgs{',
      'height:160px;overflow-y:auto;',
      'padding:6px 8px;',
      'display:flex;flex-direction:column;gap:3px;',
      'scrollbar-width:thin;',
      'scrollbar-color:#c8a84b44 transparent;',
    '}',
    '.jin-msg{line-height:1.4;}',
    '.jin-t{color:#484848;font-size:10px;margin-right:3px;}',
    '.jin-n{font-weight:bold;margin-right:3px;}',
    '.jin-n.g{color:#6ba8e5;}',   /* global  → bleu */
    '.jin-n.z{color:#6de56b;}',   /* zone    → vert */
    '.jin-n.c{color:#e5b86b;}',   /* commerce → or  */
    '.jin-x{color:#ccc0a0;}',
    '.jin-sys{color:#888;font-style:italic;font-size:11px;line-height:1.4;}',

    /* ── Saisie ── */
    '#jin-row{',
      'display:flex;gap:4px;',
      'padding:6px 8px;',
      'border-top:1px solid #c8a84b22;',
      'background:rgba(0,0,0,.35);',
    '}',
    '#jin-input{',
      'flex:1;',
      'background:rgba(255,255,255,.07);',
      'border:1px solid #c8a84b55;border-radius:3px;',
      'color:#e0d8c0;padding:5px 8px;font-size:12px;',
      'outline:none;',
    '}',
    '#jin-input:focus{border-color:#c8a84b;}',
    '#jin-send{',
      'background:#c8a84b1a;',
      'border:1px solid #c8a84b55;',
      'color:#c8a84b;border-radius:3px;',
      'padding:5px 10px;cursor:pointer;font-size:12px;',
      'transition:background .15s;',
    '}',
    '#jin-send:hover{background:#c8a84b33;}',

    /* ── Barre de statut ── */
    '#jin-status{',
      'display:flex;align-items:center;gap:6px;',
      'padding:4px 8px;font-size:11px;color:#555;',
      'border-top:1px solid #c8a84b11;',
    '}',
    '#jin-dot{',
      'width:7px;height:7px;border-radius:50%;',
      'background:#333;flex-shrink:0;',
      'transition:background .4s;',
    '}',
    '#jin-dot.on{background:#4caf50;}',
    '#jin-dot.off{background:#c62828;}',
  ].join('');

  // ── Objet UI ─────────────────────────────────────────────────────────────────
  var UI = {
    socket:  null,
    channel: 'global',
    isOpen:  false,
    el:      {},

    build: function () {
      var style = document.createElement('style');
      style.textContent = CSS;
      document.head.appendChild(style);

      // Wrapper racine
      var wrap = document.createElement('div');
      wrap.id  = 'jin-wrap';

      // ── Panel ──
      var panel = document.createElement('div');
      panel.id  = 'jin-panel';

      // Onglets
      var tabs = document.createElement('div');
      tabs.id  = 'jin-tabs';
      [
        { id:'global',  label:'🌍 Global'   },
        { id:'zone',    label:'📍 Zone'     },
        { id:'trade',   label:'💰 Commerce' }
      ].forEach(function (t) {
        var btn = document.createElement('button');
        btn.className   = 'jin-tab' + (t.id === 'global' ? ' active' : '');
        btn.dataset.ch  = t.id;
        btn.textContent = t.label;
        btn.addEventListener('click', function () { UI.switchChannel(t.id); });
        tabs.appendChild(btn);
        UI.el['tab_' + t.id] = btn;
      });

      // Messages
      var msgs = document.createElement('div');
      msgs.id  = 'jin-msgs';

      // Ligne de saisie
      var row  = document.createElement('div');
      row.id   = 'jin-row';

      var input       = document.createElement('input');
      input.id        = 'jin-input';
      input.type      = 'text';
      input.maxLength = 200;
      input.placeholder = 'Message…';
      // Bloquer la capture RPG Maker pendant la saisie
      ['keydown','keyup','keypress'].forEach(function (ev) {
        input.addEventListener(ev, function (e) {
          e.stopPropagation();
          if (ev === 'keydown') {
            if (e.key === 'Enter')  UI.send();
            if (e.key === 'Escape') UI.close();
          }
        });
      });

      var sendBtn         = document.createElement('button');
      sendBtn.id          = 'jin-send';
      sendBtn.textContent = 'Envoyer';
      sendBtn.addEventListener('click', function () { UI.send(); });

      row.appendChild(input);
      row.appendChild(sendBtn);

      // Statut
      var status  = document.createElement('div');
      status.id   = 'jin-status';
      var dot     = document.createElement('span');
      dot.id      = 'jin-dot';
      var statTxt = document.createElement('span');
      statTxt.textContent = 'Déconnecté';
      status.appendChild(dot);
      status.appendChild(statTxt);

      panel.appendChild(tabs);
      panel.appendChild(msgs);
      panel.appendChild(row);
      panel.appendChild(status);

      // ── Bouton toggle ──
      var btn = document.createElement('button');
      btn.id  = 'jin-btn';
      btn.innerHTML = '💬';
      btn.title = 'Ouvrir / Fermer le chat';
      btn.addEventListener('click', function () { UI.toggle(); });

      // Assemblage : panel en haut, bouton en bas
      wrap.appendChild(panel);
      wrap.appendChild(btn);
      document.body.appendChild(wrap);

      // Références
      UI.el.wrap   = wrap;
      UI.el.panel  = panel;
      UI.el.msgs   = msgs;
      UI.el.input  = input;
      UI.el.dot    = dot;
      UI.el.status = statTxt;

      UI.addSysMsg('Chat prêt — connexion au serveur…');
    },

    connect: function () {
      try {
        var s = io(SERVER_URL, {
          transports: ['websocket', 'polling'],
          reconnectionDelay: 2000,
          reconnectionAttempts: 20
        });
        UI.socket = s;

        s.on('connect', function () {
          UI.el.dot.className = 'on';
          s.emit('chat:location', mapName());
        });

        s.on('disconnect', function () {
          UI.el.dot.className = 'off';
          UI.el.status.textContent = 'Reconnexion…';
        });

        s.on('chat:players', function (n) {
          UI.el.status.textContent =
            n + ' joueur' + (n > 1 ? 's' : '') +
            ' connecté' + (n > 1 ? 's' : '');
        });

        s.on('chat:history', function (list) {
          list.forEach(function (m) { UI.addMsg(m); });
        });

        s.on('chat:message', function (m) {
          UI.addMsg(m);
        });

      } catch (e) {
        UI.addSysMsg('⚠ Erreur : ' + e.message);
      }
    },

    addMsg: function (m) {
      var el   = document.createElement('div');
      el.className = 'jin-msg';
      var time = new Date(m.timestamp || Date.now())
        .toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
      var chCls = { global:'g', zone:'z', trade:'c' }[m.channel] || 'g';

      el.innerHTML =
        '<span class="jin-t">[' + esc(time) + ']</span>' +
        '<span class="jin-n ' + chCls + '">' + esc(m.name) + '</span>' +
        '<span class="jin-x">' + esc(m.text) + '</span>';

      UI.el.msgs.appendChild(el);
      // Garder max 100 messages dans le DOM
      while (UI.el.msgs.children.length > 100) {
        UI.el.msgs.removeChild(UI.el.msgs.firstChild);
      }
      UI.el.msgs.scrollTop = UI.el.msgs.scrollHeight;
    },

    addSysMsg: function (text) {
      var el = document.createElement('div');
      el.className = 'jin-sys';
      el.textContent = text;
      UI.el.msgs.appendChild(el);
      UI.el.msgs.scrollTop = UI.el.msgs.scrollHeight;
    },

    switchChannel: function (ch) {
      UI.channel = ch;
      ['global','zone','trade'].forEach(function (c) {
        UI.el['tab_' + c].classList.toggle('active', c === ch);
      });
      // Si on passe en Zone, informer le serveur de la carte actuelle
      if (ch === 'zone' && UI.socket) {
        UI.socket.emit('chat:location', mapName());
      }
    },

    send: function () {
      var text = (UI.el.input.value || '').trim();
      if (!text) return;
      if (!UI.socket || !UI.socket.connected) {
        UI.addSysMsg('⚠ Pas connecté — réessaie dans un instant.');
        return;
      }
      UI.socket.emit('chat:send', {
        name:    playerName(),
        text:    text,
        map:     mapName(),
        channel: UI.channel
      });
      UI.el.input.value = '';
    },

    toggle:  function () { if (UI.isOpen) UI.close(); else UI.open(); },

    open: function () {
      UI.isOpen = true;
      UI.el.panel.classList.add('open');
      setTimeout(function () { UI.el.input.focus(); }, 60);
    },

    close: function () {
      UI.isOpen = false;
      UI.el.panel.classList.remove('open');
      UI.el.input.blur();
    }
  };

  // ── Initialisation ───────────────────────────────────────────────────────────
  function init() {
    if (_ready) {
      // À chaque changement de carte : informer le serveur
      if (UI.socket) UI.socket.emit('chat:location', mapName());
      return;
    }
    _ready = true;
    UI.build();
    loadScript(SOCKET_CDN, function () { UI.connect(); });
  }

  // ── Hook Scene_Map ───────────────────────────────────────────────────────────
  var _start = Scene_Map.prototype.start;
  Scene_Map.prototype.start = function () {
    _start.call(this);
    init();
  };

  // ── Commande Plugin ──────────────────────────────────────────────────────────
  var _cmd = Game_Interpreter.prototype.pluginCommand;
  Game_Interpreter.prototype.pluginCommand = function (command, args) {
    _cmd.call(this, command, args);
    if (command !== 'JIN_Chat') return;
    switch ((args[0] || '').toLowerCase()) {
      case 'open':  JIN_Chat.open();  break;
      case 'close': JIN_Chat.close(); break;
    }
  };

  // ── API publique ─────────────────────────────────────────────────────────────
  JIN_Chat.open  = function () { UI.open(); };
  JIN_Chat.close = function () { UI.close(); };
  JIN_Chat.send  = function (text) {
    if (UI.el.input) { UI.el.input.value = text; UI.send(); }
  };

})();
