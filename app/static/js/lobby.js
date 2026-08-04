(function () {
  'use strict';

  var GUIDE_COUNTDOWN_FALLBACK_SECONDS = 20;
  var STATUS_POLL_INTERVAL_MS = 3000;
  var RING_RADIUS = 34;
  var RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

  var registerForm = document.getElementById('register-form');
  var nameInput = document.getElementById('student-name');
  var formError = document.getElementById('form-error');
  var submitButton = document.getElementById('submit-button');

  var lobbyCard = document.getElementById('lobby-card');
  var viewRegister = document.querySelector('[data-view="register"]');
  var viewWaiting = document.querySelector('[data-view="waiting"]');
  var studentNameDisplay = document.getElementById('student-name-display');
  var statusText = document.getElementById('status-text');

  var countdownScreen = document.getElementById('countdown-screen');
  var countdownNumber = document.getElementById('countdown-number');
  var progressBarFill = document.getElementById('progress-bar-fill');

  var pollTimerId = null;

  function showError(message) {
    formError.textContent = message;
    formError.hidden = false;
  }

  function clearError() {
    formError.hidden = true;
    formError.textContent = '';
  }

  function showWaitingView(studentName) {
    viewRegister.hidden = true;
    viewWaiting.hidden = false;
    studentNameDisplay.textContent = studentName;
    statusText.textContent = 'منتظر شروع بازی توسط استاد هستیم...';
    startStatusPolling();
  }

  function updateCountdownDisplay(secondsLeft, totalSeconds) {
    var clamped = Math.max(secondsLeft, 0);
    
    if (countdownNumber) {
      countdownNumber.textContent = String(clamped) + ' ثانیه';
    }
    
    if (progressBarFill) {
      var fractionPassed = 1 - (clamped / totalSeconds); 
      var percentage = fractionPassed * 100;
      
      progressBarFill.style.width = percentage + '%';
    }
  }

  function fetchGuideDuration() {
    return fetch('/api/lobby/settings')
      .then(function (response) {
        if (!response.ok) return null;
        return response.json();
      })
      .then(function (data) {
        return data && data.guid_time ? data.guid_time : null;
      })
      .catch(function (err) {
        console.error('خطا در دریافت تنظیمات بازی:', err);
        return null;
      });
  }

  function runCountdown(totalSeconds) {
    var secondsLeft = totalSeconds;
    updateCountdownDisplay(secondsLeft, totalSeconds);

    var countdownTimerId = setInterval(function () {
      secondsLeft -= 1;
      updateCountdownDisplay(secondsLeft, totalSeconds);
      if (secondsLeft <= 0) {
        clearInterval(countdownTimerId);
        window.location.href = 'game.html';
      }
    }, 1000);
  }

  function showCountdownAndRedirect() {
    stopStatusPolling();
    lobbyCard.hidden = true;
    countdownScreen.hidden = false;

    fetchGuideDuration().then(function (guideSeconds) {
      runCountdown(guideSeconds || GUIDE_COUNTDOWN_FALLBACK_SECONDS);
    });
  }

  function handleStatus(status) {
    if (status === 'playing') {
      showCountdownAndRedirect();
    } else if (status === 'finished') {
      stopStatusPolling();
      statusText.textContent =
        'بازی به پایان رسیده است.';
    }
  }

  function fetchStatus() {
    return fetch('/api/lobby/status')
      .then(function (response) {
        if (!response.ok) return null;
        return response.json();
      })
      .then(function (data) {
        return data ? data.status : null;
      })
      .catch(function (err) {
        console.error('خطا در دریافت وضعیت بازی:', err);
        return null;
      });
  }

  function startStatusPolling() {
    if (pollTimerId) return;
    pollTimerId = setInterval(function () {
      fetchStatus().then(handleStatus);
    }, STATUS_POLL_INTERVAL_MS);
  }

  function stopStatusPolling() {
    if (pollTimerId) {
      clearInterval(pollTimerId);
      pollTimerId = null;
    }
  }

  function checkExistingSession() {
    fetch('/api/lobby/me')
      .then(function (response) {
        if (!response.ok) return null; // هنوز ثبت‌نام نکرده؛ فرم رو نشون بده
        return response.json();
      })
      .then(function (student) {
        if (!student) return;
        return fetchStatus().then(function (status) {
          if (status === 'playing') {
            showCountdownAndRedirect();
          } else {
            showWaitingView(student.name);
          }
        });
      })
      .catch(function (err) {
        console.error('خطا در بررسی نشست قبلی:', err);
      });
  }

  registerForm.addEventListener('submit', function (event) {
    event.preventDefault();
    clearError();

    var name = nameInput.value.trim();
    if (!name) {
      showError('لطفاً نام خود را وارد کن.');
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'در حال ثبت‌نام...';

    fetch('/api/lobby/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name }),
    })
      .then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, data: data };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          showError(result.data.detail || 'ثبت‌نام انجام نشد، دوباره تلاش کن.');
          return;
        }
        showWaitingView(result.data.name);
      })
      .catch(function () {
        showError('ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کن.');
      })
      .finally(function () {
        submitButton.disabled = false;
        submitButton.textContent = 'ورود به بازی';
      });
  });

  checkExistingSession();
})();