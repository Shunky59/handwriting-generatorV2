(async function bootstrap() {
  try {
    await Fonts.loadAll('fonts/');
  } catch (err) {
    console.error('Font loading failed:', err);
    alert('Could not load the font library. If you are opening this file directly (file://), run it through a local server instead — browsers block font fetches from the filesystem.');
    return;
  }

  applyPagePreset(AppState.page.presetId);

  UI.init();
})();
