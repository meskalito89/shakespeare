const sceneTabs = document.getElementById('sceneTabs');
const addSceneBtn = document.getElementById('addSceneBtn');
const sceneNameInput = document.getElementById('sceneName');
const sceneDescriptionInput = document.getElementById('sceneDescription');
const saveSceneBtn = document.getElementById('saveSceneBtn');
const addCellBtn = document.getElementById('addCellBtn');
const cellsContainer = document.getElementById('cellsContainer');
const exportBtn = document.getElementById('exportBtn');
const importInput = document.getElementById('importInput');
const activeSceneTitle = document.getElementById('activeSceneTitle');
const activeSceneDescription = document.getElementById('activeSceneDescription');
const audioList = document.getElementById('audioList');
const cellTemplate = document.getElementById('cellTemplate');
const toggleSceneSettingsBtn = document.getElementById('toggleSceneSettingsBtn');
const sceneSettingsEl = document.querySelector('.scene-settings');

const state = {
  scenes: [],
  activeSceneId: null,
};

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
    secondClickAction: 'fade',
  };
}

function getActiveScene() {
  return state.scenes.find(scene => scene.id === state.activeSceneId);
}

function updateSceneTabs() {
  sceneTabs.innerHTML = '';
  state.scenes.forEach(scene => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'scene-tab' + (scene.id === state.activeSceneId ? ' active' : '');
    tab.textContent = scene.name;
    tab.addEventListener('click', () => setActiveScene(scene.id));
    sceneTabs.appendChild(tab);
  });
}

function appendAudioListItem(index, cell, audio) {
  if (!audioList) return;
  const item = document.createElement('div');
  item.className = 'audio-item';

  const description = document.createElement('span');
  description.textContent = cell.audioSource
    ? `Cell ${index}: ${cell.audioSource}`
    : `Cell ${index}: No audio assigned`;

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = cell.audioSource ? 'Play' : 'No audio';
  button.disabled = !cell.audioSource;

  if (cell.audioSource) {
    button.addEventListener('click', () => {
      if (audio.paused) {
        audio.play();
        button.textContent = 'Pause';
      } else {
        audio.pause();
        button.textContent = 'Play';
      }
    });

    audio.addEventListener('ended', () => {
      button.textContent = 'Play';
    });
  }

  item.append(description, button);
  audioList.appendChild(item);
}

function renderScene() {
  const scene = getActiveScene();
  if (!scene) {
    addScene();
    return;
  }

  updateSceneTabs();
  sceneNameInput.value = scene.name;
  sceneDescriptionInput.value = scene.description;
  activeSceneTitle.textContent = scene.name;
  activeSceneDescription.textContent = scene.description || 'No description yet.';
  cellsContainer.innerHTML = '';
  if (audioList) audioList.innerHTML = '';

  for (let i = 0; i < 100; i++) {
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

      slot.addEventListener('dragover', (ev) => ev.preventDefault());
      slot.addEventListener('drop', (ev) => {
        ev.preventDefault();
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
    const toggleConfigBtn = node.querySelector('.toggle-config');
    const descriptionInput = node.querySelector('.cell-description');
    const imageUrlInput = node.querySelector('.image-url');
    const imageFileInput = node.querySelector('.image-file');
    const audioUrlInput = node.querySelector('.audio-url');
    const audioFileInput = node.querySelector('.audio-file');
    const secondClickSelect = node.querySelector('.second-click-action');
    const copySceneSelect = node.querySelector('.copy-scene');
    const copyButton = node.querySelector('.copy-button');
    const removeCellBtn = node.querySelector('.remove-cellBtn');

    const audio = document.createElement('audio');
    audio.preload = 'auto';
    audio.src = cell.audioSource || '';
    audio.addEventListener('ended', () => {
      playButton.textContent = '▶';
    });

    appendAudioListItem(i + 1, cell, audio);

    function updateBackground() {
      if (cell.imageSource) {
        node.dataset.image = 'true';
        preview.style.setProperty('--cell-bg-image', `url('${cell.imageSource}')`);
      } else {
        delete node.dataset.image;
        preview.style.removeProperty('--cell-bg-image');
      }
    }

    function syncAudioSrc(source) {
      audio.src = source;
      cell.audioSource = source;
    }

    function handlePlayClick(event) {
      event.stopPropagation();
      if (!audio.src) {
        playButton.textContent = '▶';
        return;
      }
      if (audio.paused) {
        audio.volume = 1;
        audio.play();
        playButton.textContent = '❚❚';
      } else {
        applySecondClickAction();
      }
    }

    function applySecondClickAction() {
      if (!audio.src) return;
      const action = cell.secondClickAction;
      if (action === 'pause') {
        audio.pause();
        playButton.textContent = '▶';
      } else if (action === 'stop') {
        audio.pause();
        audio.currentTime = 0;
        playButton.textContent = '▶';
      } else {
        fadeOutAudio();
      }
    }

    function fadeOutAudio() {
      if (audio.paused) return;
      const fadeDuration = 700;
      const steps = 14;
      const stepTime = fadeDuration / steps;
      let currentStep = 0;
      const volumeStart = audio.volume;
      const fade = setInterval(() => {
        currentStep += 1;
        const nextVolume = Math.max(0, volumeStart * (1 - currentStep / steps));
        audio.volume = nextVolume;
        if (currentStep >= steps) {
          clearInterval(fade);
          audio.pause();
          audio.currentTime = 0;
          audio.volume = 1;
          playButton.textContent = '▶';
        }
      }, stepTime);
    }

    // drag handlers
    node.addEventListener('dragstart', (ev) => {
      ev.dataTransfer.setData('text/plain', i.toString());
    });
    node.addEventListener('dragover', (ev) => ev.preventDefault());
    node.addEventListener('drop', (ev) => {
      ev.preventDefault();
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
    });

    imageUrlInput.value = cell.imageSource && !cell.imageSource.startsWith('data:') ? cell.imageSource : '';
    imageUrlInput.addEventListener('change', () => {
      const value = imageUrlInput.value.trim();
      cell.imageSource = value;
      updateBackground();
    });

    imageFileInput.addEventListener('change', async () => {
      const file = imageFileInput.files[0];
      if (!file) return;
      cell.imageSource = await readFileAsDataURL(file);
      imageUrlInput.value = '';
      updateBackground();
    });

    audioUrlInput.value = cell.audioSource && !cell.audioSource.startsWith('data:') ? cell.audioSource : '';
    audioUrlInput.addEventListener('change', () => {
      const value = audioUrlInput.value.trim();
      syncAudioSrc(value);
      playButton.textContent = '▶';
    });

    audioFileInput.addEventListener('change', async () => {
      const file = audioFileInput.files[0];
      if (!file) return;
      const dataUrl = await readFileAsDataURL(file);
      syncAudioSrc(dataUrl);
      audioUrlInput.value = '';
      playButton.textContent = '▶';
    });

    secondClickSelect.value = cell.secondClickAction;
    secondClickSelect.addEventListener('change', () => {
      cell.secondClickAction = secondClickSelect.value;
    });

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
  const payload = JSON.stringify(state.scenes, null, 2);
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
      const importedScenes = JSON.parse(reader.result);
      if (!Array.isArray(importedScenes)) {
        throw new Error('Invalid configuration file.');
      }
      state.scenes = importedScenes.map(scene => {
        const cellsArr = new Array(100).fill(null);
        if (Array.isArray(scene.cells)) {
          for (let i = 0; i < Math.min(100, scene.cells.length); i++) {
            const cell = scene.cells[i];
            if (!cell) continue;
            cellsArr[i] = {
              id: cell.id || generateId(),
              description: cell.description || '',
              imageSource: cell.imageSource || '',
              audioSource: cell.audioSource || '',
              secondClickAction: ['fade', 'pause', 'stop'].includes(cell.secondClickAction)
                ? cell.secondClickAction
                : 'fade',
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
  activeSceneTitle.textContent = scene.name;
});

sceneDescriptionInput.addEventListener('input', () => {
  const scene = getActiveScene();
  if (!scene) return;
  scene.description = sceneDescriptionInput.value.trim();
  activeSceneDescription.textContent = scene.description || 'No description yet.';
});

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
  if (state.scenes.length === 0) addScene();
  renderScene();
});
