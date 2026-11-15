import { pressedKeys } from './input.js';

/**
 * Interactive Real Car Steering Wheel and Sport Pedals HUD
 * Handles touch (mobile/tablet) and mouse (laptop/desktop)
 */
export function initTouchControls() {
  const container = document.createElement('div');
  container.id = 'touch-hud';
  container.className = 'touch-hud';

  container.innerHTML = `
    <!-- STEERING WHEEL (Bottom-Left) -->
    <div id="wheel-zone" class="wheel-zone">
      <div id="steering-wheel" class="steering-wheel">
        <!-- Top 12 o'clock Red Racing Marker -->
        <div class="wheel-marker"></div>
        <!-- Outer Leather Rim -->
        <div class="wheel-rim"></div>
        <!-- Inner Ring -->
        <div class="wheel-inner-ring"></div>
        <!-- Left Spoke -->
        <div class="wheel-spoke spoke-left"></div>
        <!-- Right Spoke -->
        <div class="wheel-spoke spoke-right"></div>
        <!-- Bottom Spoke -->
        <div class="wheel-spoke spoke-bottom"></div>
        <!-- Center Horn Hub with Racing Logo -->
        <div class="wheel-hub">
          <div class="hub-logo">🏁</div>
        </div>
      </div>
      <div class="wheel-hint">DRAG TO STEER</div>
    </div>

    <!-- PEDALS & BOOST (Bottom-Right) -->
    <div class="pedals-zone">
      <!-- Nitro / Handbrake Drift Button -->
      <button id="btn-drift" class="pedal-nitro" type="button">
        <span class="nitro-icon">🔥</span>
        <span class="nitro-label">NITRO</span>
      </button>

      <!-- Brake Pedal -->
      <div id="pedal-brake" class="pedal pedal-brake">
        <div class="pedal-ridges"></div>
        <span class="pedal-label">BRAKE</span>
      </div>

      <!-- Gas / Accelerator Pedal -->
      <div id="pedal-gas" class="pedal pedal-gas">
        <div class="pedal-ridges"></div>
        <span class="pedal-label">GAS</span>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  // -------------------------------------------------------------
  // STEERING WHEEL LOGIC (Rotates realistically up to ±80 degrees)
  // -------------------------------------------------------------
  const wheelZone = document.getElementById('wheel-zone');
  const wheel = document.getElementById('steering-wheel');

  let isSteering = false;
  let activeTouchId = null;
  let startAngle = 0;
  let currentWheelAngle = 0;
  let animFrameId = null;

  function getCenter(el) {
    const rect = el.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  function getPointerAngle(clientX, clientY) {
    const center = getCenter(wheel);
    const dx = clientX - center.x;
    const dy = clientY - center.y;
    return Math.atan2(dy, dx) * (180 / Math.PI);
  }

  function applySteering(angle) {
    currentWheelAngle = Math.max(-80, Math.min(80, angle));
    if (wheel) {
      wheel.style.transform = `rotate(${currentWheelAngle}deg)`;
    }

    // Deadzone of 8 degrees to keep straight easily
    if (currentWheelAngle < -10) {
      pressedKeys.add('ArrowLeft');
      pressedKeys.delete('ArrowRight');
    } else if (currentWheelAngle > 10) {
      pressedKeys.add('ArrowRight');
      pressedKeys.delete('ArrowLeft');
    } else {
      pressedKeys.delete('ArrowLeft');
      pressedKeys.delete('ArrowRight');
    }
  }

  function returnToCenter() {
    if (Math.abs(currentWheelAngle) > 1) {
      currentWheelAngle *= 0.65;
      if (wheel) {
        wheel.style.transform = `rotate(${currentWheelAngle}deg)`;
      }
      animFrameId = requestAnimationFrame(returnToCenter);
    } else {
      currentWheelAngle = 0;
      if (wheel) wheel.style.transform = `rotate(0deg)`;
      pressedKeys.delete('ArrowLeft');
      pressedKeys.delete('ArrowRight');
    }
  }

  // Touch handlers for mobile
  wheelZone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (animFrameId) cancelAnimationFrame(animFrameId);
    const touch = e.changedTouches[0];
    activeTouchId = touch.identifier;
    isSteering = true;
    startAngle = getPointerAngle(touch.clientX, touch.clientY) - currentWheelAngle;
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    if (!isSteering) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === activeTouchId) {
        e.preventDefault();
        const rawAngle = getPointerAngle(touch.clientX, touch.clientY);
        let delta = rawAngle - startAngle;
        // Normalize wrap-around
        while (delta > 180) delta -= 360;
        while (delta < -180) delta += 360;
        applySteering(delta);
        break;
      }
    }
  }, { passive: false });

  const endTouch = (e) => {
    if (!isSteering) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeTouchId) {
        isSteering = false;
        activeTouchId = null;
        returnToCenter();
        break;
      }
    }
  };
  window.addEventListener('touchend', endTouch);
  window.addEventListener('touchcancel', endTouch);

  // Mouse handlers for desktop/laptop testing
  wheelZone.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (animFrameId) cancelAnimationFrame(animFrameId);
    isSteering = true;
    startAngle = getPointerAngle(e.clientX, e.clientY) - currentWheelAngle;

    const onMouseMove = (moveEvent) => {
      if (!isSteering) return;
      const rawAngle = getPointerAngle(moveEvent.clientX, moveEvent.clientY);
      let delta = rawAngle - startAngle;
      while (delta > 180) delta -= 360;
      while (delta < -180) delta += 360;
      applySteering(delta);
    };

    const onMouseUp = () => {
      isSteering = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      returnToCenter();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });

  // -------------------------------------------------------------
  // PEDALS: GAS & BRAKE & DRIFT NITRO
  // -------------------------------------------------------------
  const gasPedal = document.getElementById('pedal-gas');
  const brakePedal = document.getElementById('pedal-brake');
  const driftBtn = document.getElementById('btn-drift');

  function bindPedal(el, keyCode) {
    if (!el) return;

    const start = (e) => {
      e.preventDefault();
      el.classList.add('active');
      pressedKeys.add(keyCode);
    };

    const stop = (e) => {
      e.preventDefault();
      el.classList.remove('active');
      pressedKeys.delete(keyCode);
    };

    el.addEventListener('touchstart', start, { passive: false });
    el.addEventListener('touchend', stop);
    el.addEventListener('touchcancel', stop);

    el.addEventListener('mousedown', start);
    el.addEventListener('mouseup', stop);
    el.addEventListener('mouseleave', stop);
  }

  bindPedal(gasPedal, 'ArrowUp');
  bindPedal(brakePedal, 'ArrowDown');
  bindPedal(driftBtn, 'Space');
}

