const sceneTabs = document.getElementById('sceneTabs');
const addSceneBtn = document.getElementById('addSceneBtn');
const sceneNameInput = document.getElementById('sceneName');
const sceneDescriptionInput = document.getElementById('sceneDescription');
const saveSceneBtn = document.getElementById('saveSceneBtn');
const addCellBtn = document.getElementById('addCellBtn');
const cellsContainer = document.getElementById('cellsContainer');
const exportBtn = document.getElementById('exportBtn');
const importInput = document.getElementById('importInput');
const projectTitleInput = document.getElementById('projectTitle');
const projectDescriptionInput = document.getElementById('projectDescription');
// scene summary and audio panel removed from DOM
const cellTemplate = document.getElementById('cellTemplate');
const toggleSceneSettingsBtn = document.getElementById('toggleSceneSettingsBtn');
const sceneSettingsEl = document.querySelector('.scene-settings');

const state = {
  project: {
    title: 'Theatre Player',
    description: 'Create scenes with visual cells, audio, and copy between scenes.',
  },
  scenes: [],
  activeSceneId: null,
};

const audioPlayers = new Map();
const borderColors = ['#4f7bff', '#f97316', '#22c55e', '#eab308', '#ec4899', '#f8fafc'];

function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function createScene(name = 'Untitled Scene', description = '') {
  return {
    id: generateId(),
    name,
    description,
    // fixed 10x10 board = 100 slots
    cells: new Array(100).fill(null),
  };
}

function createCell() {
  return {
    id: generateId(),
    description: '',
    imageSource: '',
    audioSource: '',
    volume: 1,
    // optional friendly filenames for uploaded assets
    audioName: '',
    imageName: '',
    borderColor: '#4f7bff',
    secondClickAction: 'fade',
    loopAudio: false,
  };
}

function getDroppedFiles(event) {
  return Array.from(event.dataTransfer?.files || []);
}

function isImageFile(file) {
  return file.type.startsWith('image/')
    || /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(file.name || '');
}

function isAudioFile(file) {
  return file.type.startsWith('audio/')
    || /\.(aac|flac|m4a|mp3|ogg|opus|wav|weba)$/i.test(file.name || '');
}

function hasAssetFiles(files) {
  return files.some(file => isImageFile(file) || isAudioFile(file));
}

function hasDraggedFiles(event) {
  return Array.from(event.dataTransfer?.items || []).some(item => item.kind === 'file')
    || getDroppedFiles(event).length > 0;
}

async function applyAssetFilesToCell(cell, files, callbacks = {}) {
  let changed = false;

  for (const file of files) {
    if (isImageFile(file)) {
      const dataUrl = await readFileAsDataURL(file);
      cell.imageSource = dataUrl;
      cell.imageName = file.name || '';
      callbacks.onImage?.();
      changed = true;
    } else if (isAudioFile(file)) {
      const dataUrl = await readFileAsDataURL(file);
      cell.audioSource = dataUrl;
      cell.audioName = file.name || '';
      callbacks.onAudio?.(dataUrl);
      changed = true;
    }
  }

  return changed;
}

function getActiveScene() {
  return state.scenes.find(scene => scene.id === state.activeSceneId);
}

function normalizeVolume(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(1, Math.max(0, parsed));
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainingSeconds}`;
}

function updateAudioProgress(player) {
  const audio = player.audio;
  const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
  const current = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;

  if (player.progressInput) {
    player.progressInput.max = duration > 0 ? duration.toString() : '100';
    player.progressInput.value = duration > 0 ? current.toString() : '0';
  }

  if (player.timeLabel) {
    const remaining = Math.max(0, duration - current);
    player.timeLabel.textContent = `${formatTime(current)} / -${formatTime(remaining)}`;
  }
}

function updatePlayerButton(player, isPlaying) {
  if (!player.playButton) return;
  player.playButton.textContent = isPlaying ? '❚❚' : '▶';
}

function clearFade(player) {
  if (!player.fadeTimer) return;
  clearInterval(player.fadeTimer);
  player.fadeTimer = null;
}

function stopPlayer(cellId) {
  const player = audioPlayers.get(cellId);
  if (!player) return;
  clearFade(player);
  player.audio.pause();
  player.audio.currentTime = 0;
  updatePlayerButton(player, false);
}

function fadeOutPlayer(player, cell) {
  if (!player || player.audio.paused) return;
  clearFade(player);
  const fadeDuration = 700;
  const steps = 14;
  const stepTime = fadeDuration / steps;
  let currentStep = 0;
  const volumeStart = player.audio.volume;

  player.fadeTimer = setInterval(() => {
    currentStep += 1;
    const nextVolume = Math.max(0, volumeStart * (1 - currentStep / steps));
    player.audio.volume = nextVolume;
    if (currentStep >= steps) {
      clearFade(player);
      player.audio.pause();
      player.audio.currentTime = 0;
      player.audio.volume = normalizeVolume(cell.volume);
      updatePlayerButton(player, false);
    }
  }, stepTime);
}

function stopAllPlayers() {
  audioPlayers.forEach((player) => {
    clearFade(player);
    player.audio.pause();
    player.audio.currentTime = 0;
    updatePlayerButton(player, false);
  });
}

function playCellAudio(cell) {
  if (!cell?.audioSource) return;
  cell.volume = normalizeVolume(cell.volume);
  const player = audioPlayers.get(cell.id) || getAudioPlayer(cell, null);
  clearFade(player);
  syncPlayerSource(player, cell.audioSource);
  player.audio.volume = cell.volume;
  player.audio.loop = Boolean(cell.loopAudio);
  player.audio.play()
    .then(() => updatePlayerButton(player, true))
    .catch(() => updatePlayerButton(player, false));
}

function applyCellSecondClickAction(cell, options = {}) {
  if (!cell?.audioSource) return;
  const player = audioPlayers.get(cell.id);
  if (!player || player.audio.paused) return;

  if (cell.secondClickAction === 'pause') {
    clearFade(player);
    player.audio.pause();
    updatePlayerButton(player, false);
  } else if (cell.secondClickAction === 'stop') {
    if (options.keepStopPosition) {
      clearFade(player);
      player.audio.pause();
      updatePlayerButton(player, false);
    } else {
      stopPlayer(cell.id);
    }
  } else {
    fadeOutPlayer(player, cell);
  }
}

function getBoardLineCells(scene, lineType, index) {
  const cells = [];
  for (let i = 0; i < 10; i++) {
    const cellIndex = lineType === 'row'
      ? index * 10 + i
      : i * 10 + index;
    cells.push(scene.cells[cellIndex]);
  }
  return cells;
}

function playBoardLine(lineType, index) {
  const scene = getActiveScene();
  if (!scene) return;
  const lineCells = getBoardLineCells(scene, lineType, index);
  const hasPlayingAudio = lineCells.some((cell) => {
    if (!cell) return false;
    const player = audioPlayers.get(cell.id);
    return player && !player.audio.paused;
  });

  lineCells.forEach((cell) => {
    if (hasPlayingAudio) {
      applyCellSecondClickAction(cell, { keepStopPosition: true });
    } else {
      playCellAudio(cell);
    }
  });
}

function syncPlayerSource(player, source) {
  if (player.source === source) return;
  clearFade(player);
  player.audio.pause();
  player.audio.currentTime = 0;
  player.audio.src = source;
  player.source = source;
  updatePlayerButton(player, false);
}

function getAudioPlayer(cell, playButton) {
  let player = audioPlayers.get(cell.id);
  if (!player) {
    player = {
      audio: document.createElement('audio'),
      fadeTimer: null,
      playButton: null,
      progressInput: null,
      timeLabel: null,
      source: '',
    };
    player.audio.preload = 'auto';
    player.audio.addEventListener('ended', () => {
      updatePlayerButton(player, false);
      updateAudioProgress(player);
    });
    player.audio.addEventListener('loadedmetadata', () => updateAudioProgress(player));
    player.audio.addEventListener('timeupdate', () => updateAudioProgress(player));
    audioPlayers.set(cell.id, player);
  }

  player.playButton = playButton;
  syncPlayerSource(player, cell.audioSource || '');
  player.audio.volume = normalizeVolume(cell.volume);
  player.audio.loop = Boolean(cell.loopAudio);
  updatePlayerButton(player, !player.audio.paused);
  return player;
}

function updateProjectFields() {
  if (projectTitleInput) projectTitleInput.value = state.project.title;
  if (projectDescriptionInput) projectDescriptionInput.value = state.project.description;
}

function updateSceneTabs() {
  sceneTabs.innerHTML = '';
  state.scenes.forEach(scene => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'scene-tab' + (scene.id === state.activeSceneId ? ' active' : '');
    const name = document.createElement('span');
    name.className = 'scene-tab-name';
    name.textContent = scene.name;

    const closeBtn = document.createElement('span');
    closeBtn.className = 'scene-tab-close';
    closeBtn.textContent = 'x';
    closeBtn.title = `Delete ${scene.name}`;
    closeBtn.setAttribute('role', 'button');
    closeBtn.setAttribute('tabindex', '0');
    closeBtn.setAttribute('aria-label', `Delete ${scene.name}`);
    closeBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      deleteScene(scene.id);
    });
    closeBtn.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopPropagation();
      deleteScene(scene.id);
    });

    tab.append(name, closeBtn);
    tab.addEventListener('click', () => setActiveScene(scene.id));
    sceneTabs.appendChild(tab);
  });
}

// audio panel removed — audio is controlled per-cell via play button on the preview

function renderScene() {
  const scene = getActiveScene();
  if (!scene) {
    addScene();
    return;
  }

  updateSceneTabs();
  sceneNameInput.value = scene.name;
  sceneDescriptionInput.value = scene.description;
  cellsContainer.innerHTML = '';

  const corner = document.createElement('div');
  corner.className = 'grid-play-corner';
  cellsContainer.appendChild(corner);

  for (let column = 0; column < 10; column++) {
    const columnButton = document.createElement('button');
    columnButton.type = 'button';
    columnButton.className = 'grid-play-button column-play-button';
    columnButton.textContent = '▶';
    columnButton.title = `Play column ${column + 1}`;
    columnButton.setAttribute('aria-label', `Play column ${column + 1}`);
    columnButton.addEventListener('click', () => playBoardLine('column', column));
    cellsContainer.appendChild(columnButton);
  }

  for (let i = 0; i < 100; i++) {
    if (i % 10 === 0) {
      const row = i / 10;
      const rowButton = document.createElement('button');
      rowButton.type = 'button';
      rowButton.className = 'grid-play-button row-play-button';
      rowButton.textContent = '▶';
      rowButton.title = `Play row ${row + 1}`;
      rowButton.setAttribute('aria-label', `Play row ${row + 1}`);
      rowButton.addEventListener('click', () => playBoardLine('row', row));
      cellsContainer.appendChild(rowButton);
    }

    const cell = scene.cells[i];
    if (!cell) {
      const slot = document.createElement('div');
      slot.className = 'cell-empty';
      slot.dataset.index = i;
      slot.draggable = true;

      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'primary';
      addBtn.textContent = '+';
      addBtn.title = `Add cell at ${i}`;
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        addCell(i);
      });

      slot.addEventListener('dragover', (ev) => {
        ev.preventDefault();
        if (hasDraggedFiles(ev)) slot.classList.add('cell-drop-target');
      });
      slot.addEventListener('dragleave', () => {
        slot.classList.remove('cell-drop-target');
      });
      slot.addEventListener('drop', async (ev) => {
        ev.preventDefault();
        slot.classList.remove('cell-drop-target');
        const files = getDroppedFiles(ev);
        if (hasAssetFiles(files)) {
          const nextCell = createCell();
          const changed = await applyAssetFilesToCell(nextCell, files);
          if (!changed) return;
          scene.cells[i] = nextCell;
          renderScene();
          return;
        }

        const src = parseInt(ev.dataTransfer.getData('text/plain'), 10);
        const dest = i;
        if (isNaN(src)) return;
        const moving = scene.cells[src];
        if (!moving) return;
        scene.cells[src] = null;
        scene.cells[dest] = moving;
        renderScene();
      });

      slot.appendChild(addBtn);
      cellsContainer.appendChild(slot);
      continue;
    }

    const node = cellTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.index = i;
    node.draggable = true;

    const preview = node.querySelector('.cell-preview');
    const playButton = node.querySelector('.play-button');
    const volumeControl = node.querySelector('.cell-volume-control');
    const volumeInput = node.querySelector('.cell-volume');
    const toggleConfigBtn = node.querySelector('.toggle-config');
    const descriptionInput = node.querySelector('.cell-description');
    const imageUrlInput = node.querySelector('.image-url');
    const imageFileInput = node.querySelector('.image-file');
    const audioUrlInput = node.querySelector('.audio-url');
    const audioFileInput = node.querySelector('.audio-file');
    const secondClickSelect = node.querySelector('.second-click-action');
    const loopAudioInput = node.querySelector('.loop-audio');
    const copySceneSelect = node.querySelector('.copy-scene');
    const copyButton = node.querySelector('.copy-button');
    const removeCellBtn = node.querySelector('.remove-cellBtn');
    const progressInput = document.createElement('input');
    const progressLabel = document.createElement('span');

    cell.volume = normalizeVolume(cell.volume);
    const player = getAudioPlayer(cell, playButton);
    const audio = player.audio;
    audio.loop = Boolean(cell.loopAudio);

    progressInput.type = 'range';
    progressInput.className = 'audio-progress';
    progressInput.min = '0';
    progressInput.max = '100';
    progressInput.value = '0';
    progressInput.step = '0.01';
    progressInput.setAttribute('aria-label', 'Audio progress');
    progressLabel.className = 'audio-progress-time';
    progressLabel.textContent = '0:00 / -0:00';

    const progressWrap = document.createElement('label');
    progressWrap.className = 'audio-progress-control';
    progressWrap.draggable = false;
    progressWrap.append(progressInput, progressLabel);
    preview.appendChild(progressWrap);
    player.progressInput = progressInput;
    player.timeLabel = progressLabel;
    updateAudioProgress(player);

    function updateBackground() {
      if (cell.imageSource) {
        node.dataset.image = 'true';
        preview.style.setProperty('--cell-bg-image', `url('${cell.imageSource}')`);
      } else {
        delete node.dataset.image;
        preview.style.removeProperty('--cell-bg-image');
      }
      // apply border color variable
      node.style.setProperty('--cell-border-color', cell.borderColor || 'transparent');
      // set description overlay
      const descEl = node.querySelector('.cell-desc');
      if (descEl) descEl.textContent = cell.description || '';
    }

    function syncAudioSrc(source) {
      cell.audioSource = source;
      syncPlayerSource(player, source);
    }

    function handlePlayClick(event) {
      event.stopPropagation();
      if (!audio.src) {
        playButton.textContent = '▶';
        return;
      }
      if (audio.paused) {
        playCellAudio(cell);
      } else {
        applyCellSecondClickAction(cell);
      }
    }

    if (volumeControl && volumeInput) {
      volumeInput.value = Math.round(cell.volume * 100).toString();
      const blockCellDrag = (ev) => {
        ev.stopPropagation();
        node.draggable = false;
      };
      const restoreCellDrag = () => {
        node.draggable = true;
      };
      volumeControl.addEventListener('pointerenter', () => {
        node.draggable = false;
      });
      volumeControl.addEventListener('pointerleave', restoreCellDrag);
      volumeControl.addEventListener('focusin', () => {
        node.draggable = false;
      });
      volumeControl.addEventListener('focusout', restoreCellDrag);
      volumeControl.addEventListener('pointerdown', blockCellDrag);
      volumeControl.addEventListener('mousedown', blockCellDrag);
      volumeControl.addEventListener('touchstart', blockCellDrag);
      volumeControl.addEventListener('pointerup', restoreCellDrag);
      volumeControl.addEventListener('pointercancel', restoreCellDrag);
      volumeControl.addEventListener('click', (ev) => ev.stopPropagation());
      const updateVolume = () => {
        cell.volume = normalizeVolume(Number(volumeInput.value) / 100);
        audio.volume = cell.volume;
      };
      volumeInput.addEventListener('input', updateVolume);
      volumeInput.addEventListener('change', updateVolume);
    }

    progressWrap.addEventListener('click', (ev) => ev.stopPropagation());
    progressWrap.addEventListener('pointerdown', (ev) => {
      ev.stopPropagation();
      node.draggable = false;
    });
    progressWrap.addEventListener('pointerup', () => {
      node.draggable = true;
    });
    progressWrap.addEventListener('pointercancel', () => {
      node.draggable = true;
    });
    progressInput.addEventListener('input', () => {
      if (!Number.isFinite(audio.duration)) return;
      audio.currentTime = Number(progressInput.value);
      updateAudioProgress(player);
    });

    // drag handlers
    node.addEventListener('dragstart', (ev) => {
      if (ev.target.closest('.cell-volume-control')) {
        ev.preventDefault();
        return;
      }
      ev.dataTransfer.setData('text/plain', i.toString());
    });
    node.addEventListener('dragover', (ev) => {
      ev.preventDefault();
      if (hasDraggedFiles(ev)) node.classList.add('cell-drop-target');
    });
    node.addEventListener('dragleave', () => {
      node.classList.remove('cell-drop-target');
    });
    node.addEventListener('drop', async (ev) => {
      ev.preventDefault();
      node.classList.remove('cell-drop-target');
      const files = getDroppedFiles(ev);
      if (hasAssetFiles(files)) {
        const changed = await applyAssetFilesToCell(cell, files, {
          onImage: () => {
            imageUrlInput.value = '';
            updateBackground();
          },
          onAudio: (source) => {
            audioUrlInput.value = '';
            syncAudioSrc(source);
            playButton.textContent = '▶';
          },
        });
        if (changed) updateAudioProgress(player);
        return;
      }

      const src = parseInt(ev.dataTransfer.getData('text/plain'), 10);
      const dest = i;
      if (isNaN(src) || src === dest) return;
      const moving = scene.cells[src];
      scene.cells[src] = null;
      scene.cells[dest] = moving;
      renderScene();
    });

    preview.addEventListener('click', handlePlayClick);
    playButton.addEventListener('click', handlePlayClick);
    if (toggleConfigBtn) {
      toggleConfigBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        node.classList.toggle('show-controls');
      });
    }

    descriptionInput.value = cell.description;
    descriptionInput.addEventListener('input', () => {
      cell.description = descriptionInput.value;
      const descEl = node.querySelector('.cell-desc');
      if (descEl) descEl.textContent = cell.description || '';
    });

    imageUrlInput.value = cell.imageSource && !cell.imageSource.startsWith('data:') ? cell.imageSource : '';
    imageUrlInput.addEventListener('change', () => {
      const value = imageUrlInput.value.trim();
      cell.imageSource = value;
      cell.imageName = '';
      updateBackground();
    });

    imageFileInput.addEventListener('change', async () => {
      const file = imageFileInput.files[0];
      if (!file) return;
      cell.imageSource = await readFileAsDataURL(file);
      imageUrlInput.value = '';
      cell.imageName = file.name || '';
      updateBackground();
    });

    audioUrlInput.value = cell.audioSource && !cell.audioSource.startsWith('data:') ? cell.audioSource : '';
    audioUrlInput.addEventListener('change', () => {
      const value = audioUrlInput.value.trim();
      syncAudioSrc(value);
      cell.audioName = '';
      playButton.textContent = '▶';
    });

    audioFileInput.addEventListener('change', async () => {
      const file = audioFileInput.files[0];
      if (!file) return;
      const dataUrl = await readFileAsDataURL(file);
      syncAudioSrc(dataUrl);
      audioUrlInput.value = '';
      cell.audioName = file.name || '';
      playButton.textContent = '▶';
    });

    // border color control
    const borderColorSwatches = node.querySelector('.border-color-swatches');
    if (borderColorSwatches) {
      if (!borderColors.includes(cell.borderColor)) {
        cell.borderColor = borderColors[0];
      }

      const updateSelectedBorderColor = () => {
        borderColorSwatches.querySelectorAll('.border-color-swatch').forEach((swatch) => {
          const isSelected = swatch.dataset.color === cell.borderColor;
          swatch.classList.toggle('selected', isSelected);
          swatch.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        });
      };

      borderColors.forEach((color) => {
        const swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.className = 'border-color-swatch';
        swatch.dataset.color = color;
        swatch.style.setProperty('--swatch-color', color);
        swatch.setAttribute('aria-label', `Use border color ${color}`);
        swatch.addEventListener('click', () => {
          cell.borderColor = color;
          node.style.setProperty('--cell-border-color', color);
          updateSelectedBorderColor();
        });
        borderColorSwatches.appendChild(swatch);
      });

      updateSelectedBorderColor();
    }

    secondClickSelect.value = cell.secondClickAction;
    secondClickSelect.addEventListener('change', () => {
      cell.secondClickAction = secondClickSelect.value;
    });

    if (loopAudioInput) {
      loopAudioInput.checked = Boolean(cell.loopAudio);
      loopAudioInput.addEventListener('change', () => {
        cell.loopAudio = loopAudioInput.checked;
        audio.loop = cell.loopAudio;
      });
    }

    // populate copy targets
    copySceneSelect.innerHTML = '';
    state.scenes.forEach(sceneItem => {
      if (sceneItem.id === scene.id) return;
      const option = document.createElement('option');
      option.value = sceneItem.id;
      option.textContent = sceneItem.name;
      copySceneSelect.appendChild(option);
    });

    copyButton.addEventListener('click', () => {
      const destinationId = copySceneSelect.value;
      if (!destinationId) return;
      const destinationScene = state.scenes.find(item => item.id === destinationId);
      if (!destinationScene) return;
      const destIndex = destinationScene.cells.findIndex(c => c === null);
      if (destIndex === -1) return;
      destinationScene.cells[destIndex] = JSON.parse(JSON.stringify(cell));
      destinationScene.cells[destIndex].id = generateId();
      renderScene();
    });

    removeCellBtn.addEventListener('click', () => {
      stopPlayer(cell.id);
      audioPlayers.delete(cell.id);
      scene.cells[i] = null;
      renderScene();
    });

    updateBackground();
    cellsContainer.appendChild(node);
  }
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function exportConfiguration() {
  const payload = JSON.stringify({
    project: state.project,
    scenes: state.scenes,
  }, null, 2);
  const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'theatre-player-config.json';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function importConfiguration(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      stopAllPlayers();
      audioPlayers.clear();
      const importedConfig = JSON.parse(reader.result);
      const importedProject = Array.isArray(importedConfig)
        ? {}
        : (importedConfig.project || {});
      const scenesPayload = Array.isArray(importedConfig)
        ? importedConfig
        : importedConfig.scenes;
      if (!Array.isArray(scenesPayload)) {
        throw new Error('Invalid configuration file.');
      }

      state.project = {
        title: importedProject.title || 'Theatre Player',
        description: importedProject.description || 'Create scenes with visual cells, audio, and copy between scenes.',
      };
      state.scenes = scenesPayload.map(scene => {
        const cellsArr = new Array(100).fill(null);
        if (Array.isArray(scene.cells)) {
          for (let i = 0; i < Math.min(100, scene.cells.length); i++) {
            const cell = scene.cells[i];
            if (!cell) continue;
            cellsArr[i] = {
              id: cell.id || generateId(),
              description: cell.description || '',
              imageSource: cell.imageSource || '',
              imageName: cell.imageName || '',
              audioSource: cell.audioSource || '',
              audioName: cell.audioName || '',
              volume: normalizeVolume(cell.volume),
              borderColor: cell.borderColor || '#4f7bff',
              secondClickAction: ['fade', 'pause', 'stop'].includes(cell.secondClickAction)
                ? cell.secondClickAction
                : 'fade',
              loopAudio: Boolean(cell.loopAudio),
            };
          }
        }
        return {
          id: scene.id || generateId(),
          name: scene.name || 'Scene',
          description: scene.description || '',
          cells: cellsArr,
        };
      });
      state.activeSceneId = state.scenes[0]?.id || null;
      updateProjectFields();
      renderScene();
    } catch (error) {
      alert('Unable to import configuration: ' + error.message);
    }
  };
  reader.readAsText(file);
  importInput.value = '';
}

function addScene() {
  const scene = createScene(`Scene ${state.scenes.length + 1}`, 'Describe this scene.');
  state.scenes.push(scene);
  setActiveScene(scene.id);
}

function deleteScene(sceneId) {
  const sceneIndex = state.scenes.findIndex(scene => scene.id === sceneId);
  if (sceneIndex === -1) return;

  const [removedScene] = state.scenes.splice(sceneIndex, 1);
  removedScene.cells.forEach(cell => {
    if (!cell) return;
    stopPlayer(cell.id);
    audioPlayers.delete(cell.id);
  });

  if (state.activeSceneId === sceneId) {
    const nextScene = state.scenes[sceneIndex] || state.scenes[sceneIndex - 1] || null;
    state.activeSceneId = nextScene ? nextScene.id : null;
  }

  if (state.scenes.length === 0) {
    addScene();
    return;
  }

  renderScene();
}

function addCell(index = null) {
  const scene = getActiveScene();
  if (!scene) return;
  if (index === null) {
    const firstEmpty = scene.cells.findIndex(c => c === null);
    if (firstEmpty === -1) return;
    scene.cells[firstEmpty] = createCell();
  } else {
    if (index < 0 || index >= 100) return;
    scene.cells[index] = createCell();
  }
  renderScene();
}

function saveSceneDetails() {
  const scene = getActiveScene();
  if (!scene) return;
  scene.name = sceneNameInput.value.trim() || 'Untitled Scene';
  scene.description = sceneDescriptionInput.value.trim();
  renderScene();
}

function setActiveScene(sceneId) {
  state.activeSceneId = sceneId;
  renderScene();
}

sceneNameInput.addEventListener('input', () => {
  const scene = getActiveScene();
  if (!scene) return;
  scene.name = sceneNameInput.value.trim() || 'Untitled Scene';
  updateSceneTabs();
  // title is shown in the scene tabs; no separate scene-summary element
});

sceneDescriptionInput.addEventListener('input', () => {
  const scene = getActiveScene();
  if (!scene) return;
  scene.description = sceneDescriptionInput.value.trim();
  // scene description stored; no scene-summary display
});

if (projectTitleInput) {
  projectTitleInput.addEventListener('input', () => {
    state.project.title = projectTitleInput.value.trim() || 'Theatre Player';
  });
}

if (projectDescriptionInput) {
  projectDescriptionInput.addEventListener('input', () => {
    state.project.description = projectDescriptionInput.value.trim();
  });
}

addSceneBtn.addEventListener('click', addScene);
saveSceneBtn.addEventListener('click', saveSceneDetails);
addCellBtn.addEventListener('click', () => addCell());
exportBtn.addEventListener('click', exportConfiguration);
importInput.addEventListener('change', importConfiguration);

// Scene settings toggle
if (toggleSceneSettingsBtn && sceneSettingsEl) {
  toggleSceneSettingsBtn.addEventListener('click', () => {
    sceneSettingsEl.classList.toggle('visible');
  });
}

window.addEventListener('load', () => {
  updateProjectFields();
  if (state.scenes.length === 0) addScene();
  renderScene();
});
