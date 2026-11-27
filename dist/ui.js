(() => {
  'use strict';
  const get = id => document.getElementById(id);
  const app = get('app');
  const dialog = get('dialog');
  const content = get('dialog-content');
  const buttons = [...document.querySelectorAll('[data-action]')];
  const audio = window.createLeafAudio();
  let game, mode, soundOn = false, noticeTimer;
  let currentDialog = '', haveFullscreen = false;

  document.querySelectorAll('[data-sprite]').forEach(el => {
    el.innerHTML = window.leafIcon(el.dataset.sprite);
  });

  const instructions = {
    rake: '按住拖动，把落叶耙向中央',
    jump: '落进叶堆，听叶子沙沙作响',
    rest: '来回划动，张开四肢做个落叶天使',
    toss: '抬头，看叶子慢慢飘下来'
  };
  const countText = get('count').firstChild;
  const heightText = get('height').firstChild;
  const jumpSprite = get('jump-sprite');
  const jumpIcon = jumpSprite.firstElementChild;
  jumpSprite.insertAdjacentHTML('beforeend', window.leafIcon('angel'));
  const angelIcon = jumpSprite.lastElementChild;
  let countShown = -1, heightShown = -1, restIconShown;
  const gameState = ({ count, height, mode: next }) => {
    if (count !== countShown) {
      countText.data = String(count);
      countShown = count;
    }
    if (height !== heightShown) {
      heightText.data = String(height);
      heightShown = height;
    }
    if (next === mode) return;
    if (mode) get('announcer').textContent = instructions[next];
    mode = next;
    get('field').dataset.mode = mode;
    get('hint').textContent = instructions[mode];
    const rest = mode === 'rest';
    if (rest !== restIconShown) {
      jumpIcon.style.display = rest ? 'none' : '';
      angelIcon.style.display = rest ? '' : 'none';
      get('jump-name').textContent = rest ? '划动四肢' : '跳进叶堆';
      get('jump-description').textContent = rest ? '在落叶里画一个大字' : '一头扎进松软的秋天';
      restIconShown = rest;
    }
    const selected = rest ? 'jump' : mode;
    buttons.forEach(button => {
      const active = button.dataset.action === selected;
      button.classList.toggle('selected', active);
      button.setAttribute('aria-pressed', String(active));
    });
  };
  game = window.createLeafGame(get('world'), {
    onUpdate: gameState,
    onSound: (type, intensity) => audio.play(type, intensity)
  });

  function act(action) {
    if (dialog.open) return;
    switch(action) {
      case 'rake': game.rake(); break;
      case 'sweep': game.sweep(); break;
      case 'jump': mode === 'rest' ? game.angel() : game.jump(); break;
      case 'toss': game.toss(); break;
    }
  }
  buttons.forEach(button => button.addEventListener('click', () => act(button.dataset.action)));

  function announce(message) {
    const notice = get('notice');
    clearTimeout(noticeTimer);
    notice.textContent = message;
    notice.classList.add('show');
    noticeTimer = setTimeout(() => notice.classList.remove('show'), 2300);
  }
  function pauseAsNeeded() {
    const paused = document.hidden || dialog.open;
    game.setPaused(paused);
    audio.suspend(paused);
  }
  document.addEventListener('visibilitychange', pauseAsNeeded);
  window.addEventListener('pagehide', () => { game.setPaused(true); audio.suspend(true); });
  window.addEventListener('pageshow', pauseAsNeeded);
  get('sound').addEventListener('click', () => {
    soundOn = !soundOn;
    audio.setEnabled(soundOn);
    const button = get('sound');
    const label = soundOn ? '关闭环境音' : '开启环境音';
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    button.setAttribute('aria-pressed', String(soundOn));
    button.querySelector('use').setAttribute('href', soundOn ? '#i-sound' : '#i-mute');
    if (soundOn) audio.play('rake', .27);
    announce(soundOn ? '环境音已开启' : '环境音已关闭');
  });

  function openDialog(kind, title, body) {
    currentDialog = kind;
    content.innerHTML = '<h2 id="modal-title"></h2>' + body;
    content.querySelector('h2').textContent = title;
    dialog.setAttribute('aria-labelledby', 'modal-title');
    dialog.showModal();
    pauseAsNeeded();
  }
  dialog.addEventListener('close', () => { currentDialog = ''; pauseAsNeeded(); });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) {
      const b = dialog.getBoundingClientRect();
      if (event.clientX < b.left || event.clientX > b.right || event.clientY < b.top || event.clientY > b.bottom) dialog.close();
    }
  });
  get('close').addEventListener('click', () => dialog.close());
  get('guide').addEventListener('click', () => {
    openDialog('guide', '玩法指南',
      '<ul><li><strong>耙起落叶</strong>从草地边缘朝中央的叶堆拖动。用手指轻点一簇叶子也能收拢它们。键盘按 R 可耙一下。</li>' +
      '<li><strong>跳进叶堆</strong>点「跳进叶堆」或按空格跳进去。躺下后在画面上来回划，或再按空格，伸展手脚拨开叶子。点「耙起落叶」就能站起来。</li>' +
      '<li><strong>扬起落叶</strong>随时捧起一把叶子抛向空中，看它们打着旋儿落下来。</li></ul>' +
      '<p><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> 对应下方三个动作。右上角的喇叭可以打开林间环境音。</p>' +
      '<div class="dialog-actions"><button class="primary" data-close>回到林间</button></div>');
  });
  get('reset').addEventListener('click', () => {
    openDialog('reset', '重新铺满草地？',
      '<p>这一堆落叶会重新散开，草地中央会留下一小堆，等你再来玩。</p><div class="dialog-actions"><button data-close>继续玩</button><button class="primary" data-confirm>重新开始</button></div>');
  });
  content.addEventListener('click', event => {
    if (event.target.closest('[data-close]')) dialog.close();
    if (event.target.closest('[data-confirm]') && currentDialog === 'reset') {
      dialog.close();
      game.reset();
      announce('草地上的落叶重新铺好了');
    }
  });
  const publicUrl = new URL('./', window.location.href).href;
  async function copyLink() {
    try { await navigator.clipboard.writeText(publicUrl); return true; } catch { return false; }
  }
  function manualShare() {
    openDialog('share', '分享这片秋林',
      '<p>把游戏链接发给朋友，他们就能打开自己的林间空地。</p><input aria-label="游戏链接" readonly type="url"><div class="dialog-actions"><button class="primary" id="copy-link">复制链接</button></div>');
    const input = content.querySelector('input');
    input.value = publicUrl;
    input.addEventListener('focus', () => input.select());
    get('copy-link').addEventListener('click', async () => {
      let copied = await copyLink();
      if (!copied) {
        input.focus(); input.select();
        try { copied = document.execCommand('copy'); } catch {}
      }
      if (copied) { dialog.close(); announce('游戏链接已复制'); }
      else announce('已选中链接，可以长按或按 Ctrl+C 复制');
    });
  }
  get('share').addEventListener('click', async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title:'落叶游乐场', text:'来耙一座落叶山，再一起跳进秋天。', url:publicUrl });
        return;
      } catch(error) { if (error.name === 'AbortError') return; }
    }
    if (await copyLink()) announce('游戏链接已复制，可以发给朋友了');
    else manualShare();
  });

  function updateFullscreen(on) {
    app.classList.toggle('immersive', on);
    const label = on ? '退出全屏' : '全屏游玩';
    get('expand').setAttribute('title', label);
    get('expand').setAttribute('aria-label', label);
    get('expand').querySelector('use').setAttribute('href', on ? '#i-contract' : '#i-expand');
  }
  get('expand').addEventListener('click', async () => {
    if (app.classList.contains('immersive')) {
      if (document.fullscreenElement && document.exitFullscreen) {
        try { await document.exitFullscreen(); } catch {}
      }
      updateFullscreen(false);
      return;
    }
    if (document.documentElement.requestFullscreen) {
      try { await document.documentElement.requestFullscreen(); } catch {}
    }
    updateFullscreen(true);
    window.scrollTo(0,0);
  });
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) { haveFullscreen = true; updateFullscreen(true); }
    else if (haveFullscreen) { haveFullscreen = false; updateFullscreen(false); }
  });
  document.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing || dialog.open) return;
    if (event.key === 'Escape' && app.classList.contains('immersive') && !document.fullscreenElement) { updateFullscreen(false); return; }
    if (event.code === 'Space' && event.target.closest('button,input')) return;
    const action = {Digit1:'rake',Numpad1:'rake',Digit2:'jump',Numpad2:'jump',Digit3:'toss',Numpad3:'toss',Space:'jump',KeyR:'sweep'}[event.code];
    if (!action) return;
    event.preventDefault();
    if (!event.repeat) act(action);
  });
})();
