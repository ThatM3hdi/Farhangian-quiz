(function () {
    'use strict';
  
    // همون منطق شمارنده‌ی game.js: هر ۱۵ ثانیه یک بار با سرور sync می‌شه
    // و بین این فاصله‌ها، خودش هر ۱ ثانیه محلی می‌شمره تا فشار اضافه
    // روی سرور نیفته و شمارش روی نمایشگر کلاس هم نرم باشه.
    var TIME_SYNC_INTERVAL_MS = 15000;
    var WARNING_THRESHOLD_SECONDS = 30;
  
    var timerBadge = document.getElementById('timer-badge');
    var timerText = document.getElementById('timer-text');
  
    var secondsRemaining = null;
    var countdownIntervalId = null;
  
    function formatTime(totalSeconds) {
      var clamped = Math.max(0, totalSeconds);
      var minutes = Math.floor(clamped / 60);
      var seconds = clamped % 60;
      return (
        String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0')
      );
    }
  
    function updateTimerDisplay() {
      timerText.textContent = formatTime(secondsRemaining);
      timerBadge.classList.toggle('timer-warning', secondsRemaining <= WARNING_THRESHOLD_SECONDS);
      timerBadge.hidden = false;
    }
  
    function startLocalCountdown(seconds) {
      secondsRemaining = seconds;
      updateTimerDisplay();
  
      if (countdownIntervalId) clearInterval(countdownIntervalId);
      countdownIntervalId = setInterval(function () {
        secondsRemaining = Math.max(0, secondsRemaining - 1);
        updateTimerDisplay();
        if (secondsRemaining === 0) {
          clearInterval(countdownIntervalId);
          syncTimeRemaining();
        }
      }, 1000);
    }
  
    function stopAndHide() {
      if (countdownIntervalId) clearInterval(countdownIntervalId);
      timerBadge.hidden = true;
    }
  
    function syncTimeRemaining() {
      fetch('/api/game/time-remaining', { credentials: 'same-origin' })
        .then(function (response) {
          // این صفحه روی نمایشگر کلاس بازه، نه سشن یک دانش‌آموز؛ پس اگر
          // بازی هنوز شروع نشده یا سشن معتبری نیست، فقط ساعت شنی رو
          // مخفی می‌کنیم، بدون هیچ ریدایرکتی.
          return response.ok ? response.json() : null;
        })
        .then(function (data) {
          if (!data || data.status !== 'playing' || typeof data.seconds_remaining !== 'number') {
            stopAndHide();
            return;
          }
          startLocalCountdown(data.seconds_remaining);
        })
        .catch(function (err) {
          console.error('خطا در همگام‌سازی شمارنده زمان (صفحه لیدربرد):', err);
        });
    }
  
    syncTimeRemaining();
    setInterval(syncTimeRemaining, TIME_SYNC_INTERVAL_MS);
  })();