/* ============================================================
   Super Noah mascot — reactions only. Touches no game logic.
   Makes the mascot do a celebratory hop whenever confetti fires
   or a home tile is tapped.
   ============================================================ */
(function () {
  const mascot = document.getElementById('mascot');
  if (!mascot) return;

  let cheerTimer = null;
  function cheer() {
    mascot.classList.remove('cheer');
    void mascot.offsetWidth;          // restart animation
    mascot.classList.add('cheer');
    clearTimeout(cheerTimer);
    cheerTimer = setTimeout(() => mascot.classList.remove('cheer'), 750);
  }

  // Celebrate whenever confetti bursts (wins, streaks, party button…).
  // Decoupled via a CustomEvent so this works regardless of script.js
  // scope/load order (no global monkey-patching).
  // Requires script.js confettiBurst to dispatch 'noah:confetti'.
  window.addEventListener('noah:confetti', cheer);

  // A little hop when picking a game from the home grid
  document.querySelectorAll('.tile').forEach((tile) => {
    tile.addEventListener('pointerdown', cheer, { passive: true });
  });

  // Hop when heading home or toggling the global buttons too
  ['homeBtn', 'soundToggle', 'partyBtn'].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('pointerdown', cheer, { passive: true });
  });

  // Poke the hero to make him wave/jump
  mascot.addEventListener('pointerdown', cheer);
})();
