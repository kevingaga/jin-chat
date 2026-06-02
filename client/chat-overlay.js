;(function (global) {
  'use strict';

  // ── Canaux ────────────────────────────────────────────────────────────────
  var CHANNELS = {
    global: { key: 'G', label: 'Général',  color: '#e8a030', prefix: '/g' },
    zone:   { key: 'Z', label: 'Zone',     color: '#5aacde', prefix: '/z' },
    trade:  { key: 'C', label: 'Commerce', color: '#7acc7a', prefix: '/c' }
  };
  var CHANNEL_ORDER = ['global', 'zone', 'trade'];

  // ── État ──────────────────────────────────────────────────────────────────
  var _socket         = null;
  var _isOpen         = false;
  var _playerName     = null;
  var _serverUrl      = 'http://localhost:3001';
  var _getMapName     = function () { return null; };
  var _activeChannel  = 'global';   // canal d'envoi actif
  var _activeFilter   = 'all';      // filtre d'affichage
  var _messages       = [];          // historique client (pour re-render au changement de filtre)

  var _el = {};

  // ── API publique ──────────────────────────────────────────────────────────
  var JinChat = {};

  /**
   * JinChat.init(options)
   *
   * options.serverUrl   — URL du serveur WebSocket
   * options.playerName  — Nom du joueur. null = affiche un prompt (mode POC)
   * options.getMapName  — function() → nom de la carte courante
   * options.rootEl      — Élément DOM de montage (défaut: #jin-chat-root)
   */
  JinChat.init = function (options) {
    options       = options || {};
    _serverUrl    = options.serverUrl  || _serverUrl;
    _getMapName   = options.getMapName || _getMapName;

    var rootEl = options.rootEl || document.getElementById('jin-chat-root');
    if (!rootEl) {
      rootEl = document.createElement('div');
      rootEl.id = 'jin-chat-root';
      document.body.appendChild(rootEl);
    }

    _buildUI(rootEl);

    if (options.playerName) {
      _playerName = options.playerName;
      _connectSocket();
      _showChatInput();
    } else {
      _showPrompt();
    }
  };

  JinChat.open   = function () { _openChat(); };
  JinChat.close  = function () { _closeChat(); };
  JinChat.toggle = function () { _isOpen ? _closeChat() : _openChat(); };
  JinChat.send   = function (text, channel) { _sendMessage(text, channel); };

  // Appelé par le plugin RMMV à chaque changement de carte
  JinChat.updateMap = function () {
    if (_socket && _socket.connected) {
      _socket.emit('chat:location', _getMapName());
    }
  };

  // ── Construction de l'interface ───────────────────────────────────────────
  function _buildUI(root) {
    // Onglets canaux
    var channelTabsHtml = [
      '<span class="jin-channel-tab active" data-filter="all">Tout</span>'
    ].concat(CHANNEL_ORDER.map(function (ch) {
      var c = CHANNELS[ch];
      return '<span class="jin-channel-tab" data-filter="' + ch + '">'
           + '<span class="jin-ch-dot">●</span>' + c.key + '</span>';
    })).join('');

    root.innerHTML = [
      // Tab toggle
      '<div class="jin-chat-tab" id="jin-chat-tab">',
      '  <span class="jin-chat-tab-left">',
      '    <span class="jin-chat-dot" id="jin-chat-dot"></span>',
      '    <span>Chat</span>',
      '  </span>',
      '  <span class="jin-chat-tab-right">',
      '    <span class="jin-chat-players" id="jin-chat-players"></span>',
      '    <span class="jin-chat-chevron" id="jin-chat-chevron">▲</span>',
      '  </span>',
      '</div>',

      // Fenêtre
      '<div class="jin-chat-window hidden" id="jin-chat-window">',
      '  <div class="jin-chat-channels" id="jin-chat-channels">', channelTabsHtml, '</div>',
      '  <div class="jin-chat-messages" id="jin-chat-messages"></div>',

      // Prompt pseudo (mode POC)
      '  <div id="jin-chat-prompt-area" class="jin-chat-prompt" style="display:none">',
      '    <label>Entrez votre pseudo :</label>',
      '    <input type="text" id="jin-chat-username" maxlength="24" autocomplete="off">',
      '    <button id="jin-chat-username-btn">Rejoindre</button>',
      '  </div>',

      // Ligne de saisie
      '  <div class="jin-chat-input-row" id="jin-chat-input-row" style="display:none">',
      '    <button class="jin-channel-btn" id="jin-channel-btn" data-channel="global">G</button>',
      '    <input class="jin-chat-input" id="jin-chat-input" type="text"',
      '           placeholder="[Entrée] pour envoyer • /g /z /c pour changer de canal"',
      '           maxlength="200" autocomplete="off">',
      '    <button class="jin-chat-send" id="jin-chat-send">↵</button>',
      '  </div>',
      '</div>'
    ].join('');

    // Références
    _el = {
      tab:         document.getElementById('jin-chat-tab'),
      dot:         document.getElementById('jin-chat-dot'),
      window:      document.getElementById('jin-chat-window'),
      channels:    document.getElementById('jin-chat-channels'),
      messages:    document.getElementById('jin-chat-messages'),
      promptArea:  document.getElementById('jin-chat-prompt-area'),
      usernameIn:  document.getElementById('jin-chat-username'),
      usernameBtn: document.getElementById('jin-chat-username-btn'),
      inputRow:    document.getElementById('jin-chat-input-row'),
      channelBtn:  document.getElementById('jin-channel-btn'),
      input:       document.getElementById('jin-chat-input'),
      send:        document.getElementById('jin-chat-send'),
      players:     document.getElementById('jin-chat-players'),
      chevron:     document.getElementById('jin-chat-chevron')
    };

    // Events
    _el.tab.addEventListener('click', JinChat.toggle);
    _el.send.addEventListener('click', _sendFromInput);
    _el.channelBtn.addEventListener('click', _cycleChannel);

    _el.input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter')  { e.preventDefault(); _sendFromInput(); }
      if (e.key === 'Escape') { _closeChat(); }
      e.stopPropagation();
    });

    _el.usernameBtn.addEventListener('click', _submitUsername);
    _el.usernameIn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') _submitUsername();
      e.stopPropagation();
    });

    // Onglets de filtre
    _el.channels.addEventListener('click', function (e) {
      var tab = e.target.closest('.jin-channel-tab');
      if (!tab) return;
      _setFilter(tab.dataset.filter);
    });

    // Ouvrir le chat avec Entrée depuis la page
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !_isOpen && _playerName) {
        e.preventDefault();
        _openChat();
      }
    });
  }

  // ── Connexion Socket.io ───────────────────────────────────────────────────
  function _connectSocket() {
    if (typeof io === 'undefined') {
      console.error('[JinChat] socket.io-client non chargé.');
      return;
    }

    _socket = io(_serverUrl, { transports: ['websocket', 'polling'] });

    _socket.on('connect', function () {
      _el.dot.classList.add('connected');
      _appendSystem('Connecté au chat JIN.');
      _socket.emit('chat:location', _getMapName());
    });

    _socket.on('disconnect', function () {
      _el.dot.classList.remove('connected');
      _appendSystem('Déconnecté — reconnexion…');
    });

    _socket.on('chat:history', function (msgs) {
      if (!msgs || !msgs.length) return;
      _appendSystem('─── Historique ───');
      msgs.forEach(function (m) { _storeAndRender(m, true); });
      _appendSystem('──────────────────');
    });

    _socket.on('chat:message', function (msg) {
      _storeAndRender(msg, false);
    });

    _socket.on('chat:players', function (count) {
      _el.players.textContent = count + ' en ligne';
    });
  }

  // ── Gestion des canaux ────────────────────────────────────────────────────
  function _cycleChannel() {
    var idx = CHANNEL_ORDER.indexOf(_activeChannel);
    _activeChannel = CHANNEL_ORDER[(idx + 1) % CHANNEL_ORDER.length];
    _updateChannelBtn();
  }

  function _updateChannelBtn() {
    var ch = CHANNELS[_activeChannel];
    _el.channelBtn.textContent             = ch.key;
    _el.channelBtn.dataset.channel         = _activeChannel;
    _el.channelBtn.style.color             = ch.color;
    _el.input.placeholder = ch.label + ' — ' + ch.prefix + ' pour changer • Échap pour fermer';
  }

  function _setFilter(filter) {
    _activeFilter = filter;
    _el.channels.querySelectorAll('.jin-channel-tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.filter === filter);
    });
    _rerenderMessages();
  }

  // ── Envoi ─────────────────────────────────────────────────────────────────
  function _sendFromInput() {
    var raw  = (_el.input.value || '').trim();
    if (!raw || !_socket) return;
    _el.input.value = '';

    // Détection des préfixes /g /z /c
    var channel = _activeChannel;
    var text    = raw;

    for (var ch in CHANNELS) {
      var prefix = CHANNELS[ch].prefix + ' ';
      if (raw.toLowerCase().startsWith(prefix)) {
        channel = ch;
        text    = raw.slice(prefix.length).trim();
        break;
      }
      // Préfixe sans espace (ex: "/z" seul)
      if (raw.toLowerCase() === CHANNELS[ch].prefix) {
        _activeChannel = ch;
        _updateChannelBtn();
        _appendSystem('Canal actif : ' + CHANNELS[ch].label + ' [' + CHANNELS[ch].key + ']');
        return;
      }
    }

    if (!text) return;
    _sendMessage(text, channel);
  }

  function _sendMessage(text, channel) {
    if (!_socket) return;
    _socket.emit('chat:send', {
      name:    _playerName,
      text:    text,
      map:     _getMapName(),
      channel: channel || _activeChannel
    });
  }

  // ── Affichage des messages ────────────────────────────────────────────────
  function _storeAndRender(msg, isHistory) {
    _messages.push(msg);
    if (_activeFilter === 'all' || _activeFilter === msg.channel) {
      _renderMessage(msg);
      if (!isHistory) _scrollToBottom();
    }
  }

  function _rerenderMessages() {
    _el.messages.innerHTML = '';
    _messages.forEach(function (m) {
      if (_activeFilter === 'all' || _activeFilter === m.channel) {
        _renderMessage(m);
      }
    });
    _scrollToBottom();
  }

  function _renderMessage(msg) {
    var isSelf = (msg.name === _playerName);
    var ch     = CHANNELS[msg.channel] || CHANNELS.global;
    var time   = msg.timestamp ? _formatTime(msg.timestamp) : '';

    var div = document.createElement('div');
    div.className    = 'jin-chat-msg';
    div.dataset.channel = msg.channel || 'global';

    div.innerHTML =
      '<span class="jin-msg-time">[' + time + ']</span> ' +
      '<span class="jin-msg-channel">[' + ch.key + ']</span>' +
      '<span class="jin-msg-name' + (isSelf ? ' jin-self' : '') + '">'
        + _escapeHtml(msg.name) + '</span>' +
      (msg.map ? ' <span class="jin-msg-map">[' + _escapeHtml(msg.map) + ']</span>' : '') +
      ' : ' + _escapeHtml(msg.text);

    _el.messages.appendChild(div);
  }

  function _appendSystem(text) {
    var div = document.createElement('div');
    div.className   = 'jin-chat-msg jin-msg-system';
    div.textContent = text;
    _el.messages.appendChild(div);
  }

  // ── Ouverture / fermeture ─────────────────────────────────────────────────
  function _openChat() {
    _isOpen = true;
    _el.window.classList.remove('hidden');
    _el.chevron.textContent = '▼';
    if (_playerName) {
      _el.input.focus();
      _scrollToBottom();
    }
  }

  function _closeChat() {
    _isOpen = false;
    _el.window.classList.add('hidden');
    _el.chevron.textContent = '▲';
    _el.input.blur();
  }

  function _showChatInput() {
    _el.promptArea.style.display = 'none';
    _el.inputRow.style.display   = 'flex';
    _updateChannelBtn();
  }

  function _showPrompt() {
    _el.promptArea.style.display = '';
    _el.inputRow.style.display   = 'none';
    _openChat();
  }

  function _submitUsername() {
    var name = (_el.usernameIn.value || '').trim();
    if (!name) return;
    _playerName = name.slice(0, 24);
    _showChatInput();
    _connectSocket();
    _el.input.focus();
  }

  // ── Utilitaires ───────────────────────────────────────────────────────────
  function _scrollToBottom() {
    _el.messages.scrollTop = _el.messages.scrollHeight;
  }

  function _formatTime(iso) {
    var d = new Date(iso);
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }

  function _escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  global.JinChat = JinChat;

})(window);
