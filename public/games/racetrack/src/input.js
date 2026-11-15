/**
 * Keyboard & Gamepad state with edge detection.
 *
 * `pressedKeys` keeps the live set (what the vehicle reads every physics step).
 * Supports standard gamepads (Xbox, PlayStation, Bluetooth Mobile Gamepads).
 */
export const pressedKeys = new Set();
const keyboardKeys = new Set();
const justPressed = new Set();

/** Keys we own: stops the page from scrolling / activating browser shortcuts. */
const OWNED = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space', 'Backspace',
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'KeyC', 'KeyF', 'KeyG', 'KeyH', 'KeyL', 'KeyM', 'KeyN', 'KeyO', 'KeyP', 'KeyR', 'KeyT', 'KeyV',
]);

let enabled = true;
let lastCameraBtn = false;
let activeGamepadName = null;

function isTypingTarget(target) {
  if (!target) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

function onKeyDown(event) {
  if (!enabled || isTypingTarget(event.target)) return;
  if (OWNED.has(event.code)) event.preventDefault();
  if (event.repeat) return;
  keyboardKeys.add(event.code);
  pressedKeys.add(event.code);
  justPressed.add(event.code);
}

function onKeyUp(event) {
  if (OWNED.has(event.code)) event.preventDefault();
  keyboardKeys.delete(event.code);
  pressedKeys.delete(event.code);
}

/** Without this, Cmd+Tab / alt-tab leaves keys stuck down and the car drives off alone. */
function releaseAll() {
  keyboardKeys.clear();
  pressedKeys.clear();
  justPressed.clear();
}

window.addEventListener('keydown', onKeyDown);
window.addEventListener('keyup', onKeyUp);
window.addEventListener('blur', releaseAll);
window.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });

// ── Gamepad API Integration (PlayStation, Xbox, Bluetooth Mobile Controllers)
window.addEventListener('gamepadconnected', (e) => {
  activeGamepadName = e.gamepad.id.split('(')[0].trim() || 'Controller';
  showGamepadToast(`🎮 Gamepad Connected: ${activeGamepadName}`);
});

window.addEventListener('gamepaddisconnected', () => {
  showGamepadToast('🎮 Gamepad Disconnected');
  activeGamepadName = null;
});

function showGamepadToast(msg) {
  const toast = document.getElementById('toast');
  if (toast) {
    toast.textContent = msg;
    toast.hidden = false;
    toast.classList.add('toast--good');
    setTimeout(() => {
      toast.hidden = true;
    }, 3500);
  }
}

/** Polls connected gamepads and updates `pressedKeys` continuously */
export function pollGamepad() {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
  const gamepads = navigator.getGamepads();
  let gp = null;
  for (let i = 0; i < gamepads.length; i++) {
    if (gamepads[i] && gamepads[i].connected) {
      gp = gamepads[i];
      break;
    }
  }
  if (!gp) return;

  const DEADZONE = 0.18;
  const stickX = gp.axes[0] || 0;
  const dpadLeft = gp.buttons[14]?.pressed;
  const dpadRight = gp.buttons[15]?.pressed;

  // Steering: Left Stick or D-Pad Left/Right
  if (stickX < -DEADZONE || dpadLeft) {
    pressedKeys.add('ArrowLeft');
    pressedKeys.delete('ArrowRight');
  } else if (stickX > DEADZONE || dpadRight) {
    pressedKeys.add('ArrowRight');
    pressedKeys.delete('ArrowLeft');
  } else {
    if (!keyboardKeys.has('ArrowLeft')) pressedKeys.delete('ArrowLeft');
    if (!keyboardKeys.has('ArrowRight')) pressedKeys.delete('ArrowRight');
  }

  // Gas / Acceleration: Right Trigger (R2/RT), Button 'A' (Cross), or D-Pad Up
  const gasTrigger = gp.buttons[7]?.value || (gp.buttons[7]?.pressed ? 1 : 0);
  const gasBtn = gp.buttons[0]?.pressed || gp.buttons[12]?.pressed;
  if (gasTrigger > 0.1 || gasBtn) {
    pressedKeys.add('ArrowUp');
  } else if (!keyboardKeys.has('ArrowUp')) {
    pressedKeys.delete('ArrowUp');
  }

  // Brake / Reverse: Left Trigger (L2/LT), Button 'B' (Circle), or D-Pad Down
  const brakeTrigger = gp.buttons[6]?.value || (gp.buttons[6]?.pressed ? 1 : 0);
  const brakeBtn = gp.buttons[1]?.pressed || gp.buttons[13]?.pressed;
  if (brakeTrigger > 0.1 || brakeBtn) {
    pressedKeys.add('ArrowDown');
  } else if (!keyboardKeys.has('ArrowDown')) {
    pressedKeys.delete('ArrowDown');
  }

  // Handbrake / Drift: Right Bumper (RB/R1) or Button 'X' (Square)
  const handbrake = gp.buttons[2]?.pressed || gp.buttons[5]?.pressed;
  if (handbrake) {
    pressedKeys.add('Space');
  } else if (!keyboardKeys.has('Space')) {
    pressedKeys.delete('Space');
  }

  // Camera toggle: Button 'Y' (Triangle)
  const cameraBtn = !!gp.buttons[3]?.pressed;
  if (cameraBtn && !lastCameraBtn) {
    justPressed.add('KeyC');
  }
  lastCameraBtn = cameraBtn;
}

/** True on the frame a key went down. Non-consuming: several systems may ask. */
export function wasPressed(code) {
  return justPressed.has(code);
}

/** Call once per frame, after all `wasPressed` checks. */
export function endFrame() {
  justPressed.clear();
}

export function setInputEnabled(next) {
  enabled = !!next;
  if (!enabled) releaseAll();
}

export { releaseAll };
