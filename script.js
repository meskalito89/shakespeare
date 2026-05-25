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
const cellTemplate = document.getElementById('cellTemplate');

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
    cells: [],
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

function addScene() {
  const scene = createScene(`Scene ${state.scenes.length + 1}`, 'Describe this scene.');
  state.scenes.push(scene);
  setActiveScene(scene.id);
}

function addCell() {
  const scene = getActiveScene();
  if (!scene) return;
  scene.cells.push(createCell());
  renderScene();
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

  scene.cells.forEach(cell => {
    const node = cellTemplate.content.firstElementChild.cloneNode(true);
    const preview = node.querySelector('.cell-preview');
    const playButton = node.querySelector('.play-button');
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
    audio.src = cell.audioSource;
    audio.addEventListener('ended', () => {
      playButton.textContent = '▶';
    });

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

    preview.addEventListener('click', handlePlayClick);
    playButton.addEventListener('click', handlePlayClick);

    descriptionInput.value = cell.description;
    descriptionInput.addEventListener('input', () => {
      cell.description = descriptionInput.value;
      renderScene();
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
      destinationScene.cells.push({
        ...JSON.parse(JSON.stringify(cell)),
        id: generateId(),
      });
      renderScene();
    });

    removeCellBtn.addEventListener('click', () => {
      const index = scene.cells.findIndex(item => item.id === cell.id);
      if (index !== -1) {
        scene.cells.splice(index, 1);
        renderScene();
      }
    });

    updateBackground();
    cellsContainer.appendChild(node);
  });
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
      state.scenes = importedScenes.map(scene => ({
        id: scene.id || generateId(),
        name: scene.name || 'Scene',
        description: scene.description || '',
        cells: Array.isArray(scene.cells)
          ? scene.cells.map(cell => ({
              id: cell.id || generateId(),
              description: cell.description || '',
              imageSource: cell.imageSource || '',
              audioSource: cell.audioSource || '',
              secondClickAction: ['fade', 'pause', 'stop'].includes(cell.secondClickAction)
                ? cell.secondClickAction
                : 'fade',
            }))
          : [],
      }));
      state.activeSceneId = state.scenes[0]?.id || null;
      renderScene();
    } catch (error) {
      alert('Unable to import configuration: ' + error.message);
    }
  };
  reader.readAsText(file);
  importInput.value = '';
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
addCellBtn.addEventListener('click', addCell);
exportBtn.addEventListener('click', exportConfiguration);
importInput.addEventListener('change', importConfiguration);

window.addEventListener('load', () => {
  if (state.scenes.length === 0) {
    addScene();
  } else {
    renderScene();
  }
});
