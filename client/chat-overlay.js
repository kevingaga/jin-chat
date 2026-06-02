;(function (global) {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────────────
  var _socket = null;
  var _isOpen = false;
  var _playerName = null;
  var _serverUrl = 'http://localhost:3001';
  var _getMapName = function () { return null; };

  // DOM refs
  var _el = {};

  // ── Public API ─────────────────────────────────────────────────────────────
  var JinChat = {};

  /**
   * JinChat.init(options)
   *
   * options.serverUrl   — WebSocket server URL
   * options.playerName  — Player name (string). If omitted, shows a username prompt.
   * options.getMapName  — Function returning current map name (for RPG Maker integration).
   * options.rootEl      — DOM element to mount into (default: #jin-chat-root)
   */
  JinChat.init = function (options) {
    options = options || {};
    _serverUrl = options.serverUrl || _serverUrl;
    _getMapName = options.getMapName || _getMapName;

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
      _showChat();
    } else {
      _showPrompt();
    }
  };

  JinChat.open  = function () { _openChat(); };
  JinChat.close = function () { _closeChat(); };
  JinChat.toggle = function () { _isOpen ? _closeChat() : _openChat(); };

  // ── Build UI ───────────────────────────────────────────────────────────────
  function _buildUI(root) {
    root.innerHTML = [
      '<div class="jin-chat-tab" id="jin-chat-tab">',
      '  <span class="jin-chat-tab-title">',
      '    <span class="jin-chat-dot" id="jin-chat-dot"></span>',
      '    <span>Chat</span>',
      '  </span>',
      '  <span>',
      '    <span class="jin-chat-players" id="jin-chat-players"></span>',
      '    <span class="jin-chat-chevron" id="jin-chat-chevron">▲</span>',
      '  </span>',
      '</div>',
      '<div class="jin-chat-window hidden" id="jin-chat-window">',
      '  <div class="jin-chat-messages" id="jin-chat-messages"></div>',
      '  <div id="jin-chat-prompt-area" class="jin-chat-prompt" style="display:none">',
      '    <label>Entrez votre pseudo :</label>',
      '    <input type="text" id="jin-chat-username" maxlength="24" autocomplete="off">',
      '    <button id="jin-chat-username-btn">Rejoindre</button>',
      '  </div>',
      '  <div class="jin-chat-input-row" id="jin-chat-input-row" style="display:none">',
      '    <input class="jin-chat-input" id="jin-chat-input" type="text"',
      '           placeholder="Appuyez sur Entrée pour envoyer" maxlength="200" autocomplete="off">',
      '    <button class="jin-chat-send" id="jin-chat-send">Envoyer</button>',
      '  </div>',
      '</div>'
    ].join('');

    _el = {
      tab:         document.getElementById('jin-chat-tab'),
      dot:         document.getElementById('jin-chat-dot'),
      window:      document.getElementById('jin-chat-window'),
      messages:    document.getElementById('jin-chat-messages'),
      promptArea:  document.getElementById('jin-chat-prompt-area'),
      usernameIn:  document.getElementById('jin-chat-username'),
      usernameBtn: document.getElementById('jin-chat-username-btn'),
      inputRow:    document.getElementById('jin-chat-input-row'),
      input:       document.getElementById('jin-chat-input'),
      send:        document.getElementById('jin-chat-send'),
      players:     document.getElementById('jin-chat-players'),
      chevron:     document.getElementById('jin-chat-chevron')
    };

    _el.tab.addEventListener('click', JinChat.toggle);

    _el.send.addEventListener('click', _sendFromInput);
    _el.input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); _sendFromInput(); }
      if (e.key === 'Escape') { _closeChat(); }
      e.stopPropagation(); // Prevent RPG Maker from capturing keystrokes
    });

    _el.usernameBtn.addEventListener('click', _submitUsername);
    _el.usernameIn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') _submitUsername();
      e.stopPropagation();
    });

    // Global: press Enter to open chat
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !_isOpen && _playerName) {
        e.preventDefault();
        _openChat();
      }
    });
  }

  // ── Connect ────────────────────────────────────────────────────────────────
  function _connectSocket() {
    if (typeof io === 'undefined') {
      console.error('[JinChat] socket.io-client non chargé.');
      return;
    }

    _socket = io(_serverUrl, { transports: ['websocket', 'polling'] });

    _socket.on('connect', function () {
      _el.dot.classList.add('connected');
      _appendSystem('Connecté au chat.');
    });

    _socket.on('disconnect', function () {
      _el.dot.classList.remove('connected');
      _appendSystem('Déconnecté. Reconnexion…');
    });

    _socket.on('chat:history', function (msgs) {
      _el.messages.innerHTML = '';
      if (msgs && msgs.length) {
        _appendSystem('─── Historique récent ───');
        msgs.forEach(function (m) { _appendMessage(m, true); });
        _appendSystem('─────────────────────────');
      }
    });

    _socket.on('chat:message', function (msg) {
      _appendMessage(msg, false);
    });

    _socket.on('chat:players', function (count) {
      _el.players.textContent = count + ' en ligne';
    });
  }

  // ── Chat actions ───────────────────────────────────────────────────────────
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

  function _showChat() {
    _el.promptArea.style.display  = 'none';
    _el.inputRow.style.display    = 'flex';
  }

  function _showPrompt() {
    _el.promptArea.style.display  = '';
    _el.inputRow.style.display    = 'none';
    _openChat();
  }

  function _submitUsername() {
    var name = (_el.usernameIn.value || '').trim();
    if (!name) return;
    _playerName = name.slice(0, 24);
    _showChat();
    _connectSocket();
    _el.input.focus();
  }

  function _sendFromInput() {
    var text = (_el.input.value || '').trim();
    if (!text || !_socket) return;
    _el.input.value = '';
    _socket.emit('chat:send', {
      name: _playerName,
      text: text,
      map: _getMapName()
    });
  }

  // ── Message rendering ──────────────────────────────────────────────────────
  function _appendMessage(msg, isHistory) {
    var isSelf = msg.name === _playerName;
    var time = msg.timestamp ? _formatTime(msg.timestamp) : '';

    var div = document.createElement('div');
    div.className = 'jin-chat-msg';
    div.innerHTML =
      '<span class="jin-chat-msg-time">[' + time + ']</span> ' +
      '<span class="jin-chat-msg-name' + (isSelf ? ' jin-self' : '') + '">' +
        _escapeHtml(msg.name) +
      '</span>' +
      (msg.map ? ' <span class="jin-chat-msg-map">[' + _escapeHtml(msg.map) + ']</span>' : '') +
      ' : ' +
      _escapeHtml(msg.text);

    _el.messages.appendChild(div);
    if (!isHistory) _scrollToBottom();
  }

  function _appendSystem(text) {
    var div = document.createElement('div');
    div.className = 'jin-chat-msg jin-chat-msg-system';
    div.textContent = text;
    _el.messages.appendChild(div);
  }

  function _scrollToBottom() {
    _el.messages.scrollTop = _el.messages.scrollHeight;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
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
