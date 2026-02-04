(function () {
  'use strict';

  // --- Constants ---
  var API_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
  var HISTORY_KEY = 'wotd_history';
  var CACHE_KEY = 'wotd_cache';
  var MAX_HISTORY = 100;
  var MAX_CACHE = 50;
  var MAX_RETRIES = 3;

  // --- DOM References ---
  var els = {};

  function cacheDom() {
    els.viewMain = document.getElementById('view-main');
    els.viewHistory = document.getElementById('view-history');
    els.loading = document.getElementById('loading');
    els.error = document.getElementById('error');
    els.errorMessage = document.getElementById('error-message');
    els.wordCard = document.getElementById('word-card');
    els.wordText = document.getElementById('word-text');
    els.wordPhonetic = document.getElementById('word-phonetic');
    els.wordMeanings = document.getElementById('word-meanings');
    els.btnNewWord = document.getElementById('btn-new-word');
    els.btnRetry = document.getElementById('btn-retry');
    els.btnShowHistory = document.getElementById('btn-show-history');
    els.btnBack = document.getElementById('btn-back');
    els.historyList = document.getElementById('history-list');
    els.historyEmpty = document.getElementById('history-empty');
  }

  // --- State ---
  var currentWord = null;

  // --- Utility: DJB2 Hash ---
  function djb2Hash(str) {
    var hash = 5381;
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // --- Date Helpers ---
  function getTodayString() {
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function formatDateShort(dateStr) {
    var parts = dateStr.split('-');
    var d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // --- Word Selection ---
  function getDailyWord() {
    var dateStr = getTodayString();
    var index = djb2Hash(dateStr) % window.UNCOMMON_WORDS.length;
    return window.UNCOMMON_WORDS[index];
  }

  function getRandomWord(exclude) {
    var words = window.UNCOMMON_WORDS;
    var word;
    do {
      word = words[Math.floor(Math.random() * words.length)];
    } while (word === exclude && words.length > 1);
    return word;
  }

  // --- localStorage Helpers ---
  function getJSON(key) {
    try {
      var data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  function setJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // Storage full or unavailable — silently fail
    }
  }

  // --- Cache ---
  function getCachedWord(word) {
    var cache = getJSON(CACHE_KEY) || {};
    return cache[word] || null;
  }

  function setCachedWord(word, data) {
    var cache = getJSON(CACHE_KEY) || {};
    if (Object.keys(cache).length >= MAX_CACHE) {
      cache = {}; // Clear when full
    }
    cache[word] = data;
    setJSON(CACHE_KEY, cache);
  }

  // --- History ---
  function getHistory() {
    return getJSON(HISTORY_KEY) || [];
  }

  function addToHistory(word) {
    var history = getHistory();
    var today = getTodayString();
    // Deduplicate by date
    history = history.filter(function (entry) {
      return entry.date !== today;
    });
    history.unshift({ date: today, word: word });
    if (history.length > MAX_HISTORY) {
      history = history.slice(0, MAX_HISTORY);
    }
    setJSON(HISTORY_KEY, history);
  }

  // --- API ---
  function parseApiResponse(data) {
    var entry = data[0];
    var phonetic = '';

    // Try to find a phonetic text
    if (entry.phonetic) {
      phonetic = entry.phonetic;
    } else if (entry.phonetics && entry.phonetics.length) {
      for (var i = 0; i < entry.phonetics.length; i++) {
        if (entry.phonetics[i].text) {
          phonetic = entry.phonetics[i].text;
          break;
        }
      }
    }

    var meanings = [];
    if (entry.meanings) {
      entry.meanings.forEach(function (m) {
        var defs = [];
        if (m.definitions) {
          m.definitions.slice(0, 3).forEach(function (d) {
            defs.push({
              definition: d.definition,
              example: d.example || null
            });
          });
        }
        meanings.push({
          partOfSpeech: m.partOfSpeech,
          definitions: defs
        });
      });
    }

    return {
      word: entry.word,
      phonetic: phonetic,
      meanings: meanings
    };
  }

  function fetchWord(word, retries) {
    if (retries === undefined) retries = 0;

    // Check cache first
    var cached = getCachedWord(word);
    if (cached) {
      return Promise.resolve(cached);
    }

    return fetch(API_URL + encodeURIComponent(word))
      .then(function (res) {
        if (!res.ok) {
          if (res.status === 404 && retries < MAX_RETRIES) {
            // Word not in API — try a different one
            var fallback = getRandomWord(word);
            return fetchWord(fallback, retries + 1);
          }
          throw new Error('Word not found');
        }
        return res.json();
      })
      .then(function (data) {
        var parsed = parseApiResponse(data);
        setCachedWord(parsed.word, parsed);
        return parsed;
      });
  }

  // --- Rendering ---
  function showState(state) {
    els.loading.classList.toggle('hidden', state !== 'loading');
    els.error.classList.toggle('hidden', state !== 'error');
    els.wordCard.classList.toggle('hidden', state !== 'word');
  }

  function renderWord(data) {
    currentWord = data.word;
    els.wordText.textContent = data.word;
    els.wordPhonetic.textContent = data.phonetic || '';
    els.wordPhonetic.classList.toggle('hidden', !data.phonetic);

    els.wordMeanings.innerHTML = '';
    data.meanings.forEach(function (m) {
      var group = document.createElement('div');
      group.className = 'meaning-group';

      var pos = document.createElement('p');
      pos.className = 'meaning-pos';
      pos.textContent = m.partOfSpeech;
      group.appendChild(pos);

      m.definitions.forEach(function (d) {
        var def = document.createElement('p');
        def.className = 'meaning-def';
        def.textContent = d.definition;
        group.appendChild(def);

        if (d.example) {
          var ex = document.createElement('p');
          ex.className = 'meaning-example';
          ex.textContent = d.example;
          group.appendChild(ex);
        }
      });

      els.wordMeanings.appendChild(group);
    });

    showState('word');
    els.wordText.focus();
  }

  function showError(msg) {
    els.errorMessage.textContent = msg || 'Something went wrong. Please try again.';
    showState('error');
  }

  // --- Load Word ---
  function loadWord(word) {
    showState('loading');
    fetchWord(word)
      .then(function (data) {
        renderWord(data);
        addToHistory(data.word);
      })
      .catch(function () {
        showError('Could not load word. Check your connection and try again.');
      });
  }

  // --- History View ---
  function renderHistory() {
    var history = getHistory();
    els.historyList.innerHTML = '';

    if (history.length === 0) {
      els.historyEmpty.classList.remove('hidden');
      return;
    }

    els.historyEmpty.classList.add('hidden');

    history.forEach(function (entry) {
      var li = document.createElement('li');
      li.className = 'history-item';
      li.setAttribute('tabindex', '0');
      li.setAttribute('role', 'button');
      li.setAttribute('aria-label', 'View word: ' + entry.word);

      var dateSpan = document.createElement('span');
      dateSpan.className = 'history-date';
      dateSpan.textContent = formatDateShort(entry.date);

      var wordSpan = document.createElement('span');
      wordSpan.className = 'history-word';
      wordSpan.textContent = entry.word;

      li.appendChild(dateSpan);
      li.appendChild(wordSpan);

      li.addEventListener('click', function () {
        showView('main');
        loadWord(entry.word);
      });

      li.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          showView('main');
          loadWord(entry.word);
        }
      });

      els.historyList.appendChild(li);
    });
  }

  // --- View Toggling ---
  function showView(view) {
    if (view === 'history') {
      els.viewMain.classList.add('hidden');
      els.viewHistory.classList.remove('hidden');
      renderHistory();
      els.viewHistory.querySelector('h2').focus();
    } else {
      els.viewHistory.classList.add('hidden');
      els.viewMain.classList.remove('hidden');
    }
  }

  // --- Event Binding ---
  function bindEvents() {
    els.btnNewWord.addEventListener('click', function () {
      var word = getRandomWord(currentWord);
      loadWord(word);
    });

    els.btnRetry.addEventListener('click', function () {
      var word = currentWord || getDailyWord();
      loadWord(word);
    });

    els.btnShowHistory.addEventListener('click', function () {
      showView('history');
    });

    els.btnBack.addEventListener('click', function () {
      showView('main');
    });
  }

  // --- Init ---
  function init() {
    cacheDom();
    bindEvents();
    loadWord(getDailyWord());
  }

  document.addEventListener('DOMContentLoaded', init);
})();
