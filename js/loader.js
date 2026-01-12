(function() {
  // --- Create and Inject CSS ---
  const styles = `
    .loader-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background-color: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
      opacity: 1;
      visibility: visible;
      transition: opacity 0.4s ease-out, visibility 0.4s ease-out;
    }

    .loader-overlay.hidden {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }

    #lottie-loader {
      width: 200px;
      height: 200px;
    }
  `;
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);


  // --- Create and Inject HTML ---
  const loaderHtml = `
    <div id="global-loader-overlay" class="loader-overlay">
      <div id="lottie-loader"></div>
    </div>
  `;
  // We'll wait for DOMContentLoaded to ensure the body exists before injecting.
  document.addEventListener('DOMContentLoaded', () => {
    document.body.insertAdjacentHTML('beforeend', loaderHtml);
    // Once injected, we can initialize everything that depends on the DOM.
    initializeLoaderLogic();
  });


  // --- Loader Core Logic & Lottie Initialization ---
  let loaderCounter = 1; // Start at 1 for initial page load
  let failSafeTimeout;
  let loaderOverlay;
  let lottieAnimation;

  const FAILSAFE_TIMEOUT_DURATION = 10000; // 10 seconds

  const forceHide = () => {
    if (loaderOverlay) {
      loaderOverlay.classList.add('hidden');
    }
    if (lottieAnimation) lottieAnimation.stop();
    loaderCounter = 0; // Reset counter
    clearTimeout(failSafeTimeout);
    console.warn('Loader force-hidden due to failsafe timeout.');
  };

  window.showLoader = function() {
    // Each call to show resets the failsafe timer.
    clearTimeout(failSafeTimeout);
    failSafeTimeout = setTimeout(forceHide, FAILSAFE_TIMEOUT_DURATION);

    if (loaderCounter === 0 && loaderOverlay) {
      loaderOverlay.classList.remove('hidden');
      if (lottieAnimation) lottieAnimation.play();
    }
    loaderCounter++;
  };

  window.hideLoader = function() {
    loaderCounter--;
    if (loaderCounter <= 0) {
      loaderCounter = 0; // Ensure it doesn't go negative
      if (loaderOverlay) {
        loaderOverlay.classList.add('hidden');
      }
      if (lottieAnimation) {
        // Give fadeout time before stopping animation
        setTimeout(() => lottieAnimation.stop(), 400);
      }
      clearTimeout(failSafeTimeout);
    }
  };

  function initializeLoaderLogic() {
    loaderOverlay = document.getElementById('global-loader-overlay');
    const lottieContainer = document.getElementById('lottie-loader');

    // Check if lottie library is available.
    // This script assumes the Lottie CDN script is loaded before it.
    if (typeof lottie !== 'undefined' && lottieContainer) {
      lottieAnimation = lottie.loadAnimation({
        container: lottieContainer,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        path: 'assets/lottie/loader.json'
      });
    } else {
        console.error('Lottie library (bodymovin) or loader container not found.');
    }

    // Start failsafe timer for the initial page load.
    failSafeTimeout = setTimeout(forceHide, FAILSAFE_TIMEOUT_DURATION);
  }

  // Hide loader after all initial page resources (images, scripts, etc.) are fully loaded.
  window.addEventListener('load', () => {
      window.hideLoader();
  });

})();
