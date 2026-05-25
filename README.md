# Theatre Player

Theatre Player is a small browser-based scene player for arranging visual cells with images, text, and audio. It is useful for theatre cues, performances, rehearsals, installations, or any workflow where you need multiple scenes with clickable media cells.

## Features

- Create multiple scenes.
- Add up to 100 visual cells per scene.
- Add an image to each cell from a URL or uploaded file.
- Add audio to each cell from a URL or uploaded file.
- Play, pause, stop, or fade audio on a second click.
- Adjust volume per cell.
- See audio progress and remaining time.
- Loop audio per cell.
- Add cell descriptions.
- Set a border color for cells.
- Drag cells to reorder them.
- Copy cells between scenes.
- Export and import the full project configuration.
- Edit the project title and description directly in the header.

## How To Run

Open `index.html` in a browser.

No build step, package install, or server is required. The project is plain HTML, CSS, and JavaScript.

## How To Use

1. Edit the project title and description at the top of the page.
2. Use `+ Add Scene` to create a new scene.
3. Use `+ Add Cell` or click an empty grid slot to create a cell.
4. Click the gear icon on a cell to open its settings.
5. Add an image using `Image URL` or `Upload Image`.
6. Add audio using `Audio URL` or `Upload Audio`.
7. Choose what happens on a second click:
   - `Fade out`
   - `Pause`
   - `Stop`
8. Enable `Loop audio` if the audio should repeat.
9. Use the volume slider and progress bar directly on the cell.
10. Drag cells around the grid to rearrange them.
11. Use `Copy cell` to copy a cell into another scene.

## Saving And Loading

Use `Export Configuration` to download a JSON file with the project, scenes, cells, images, audio references, and settings.

Use `Import Configuration` to load a previously exported JSON file.

Uploaded images and audio are stored inside the exported JSON as data URLs, so large media files can make the configuration file large.

## Files

- `index.html` - page structure and templates.
- `styles.css` - visual design and layout.
- `script.js` - scene, cell, audio, import, and export logic.
