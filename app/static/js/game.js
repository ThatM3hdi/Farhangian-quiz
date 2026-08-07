document.addEventListener("DOMContentLoaded", function () {
  'use strict';

  // آدرس صفحه لیدربرد. این فایل هنوز طبق مستندات پروژه ساخته نشده؛
  // هر وقت ساختی، در صورت نیاز همین یک خط را عوض کن.
  var LEADERBOARD_URL = '/';    
  var LOBBY_URL = 'lobby';
  var FEEDBACK_DELAY_MS = 500;
  var TIME_SYNC_INTERVAL_MS = 15000; // هر ۱۵ ثانیه با سرور همگام‌سازی می‌شود

  var options = document.querySelectorAll('.option-item');
  var blank = document.getElementById('blank');
  var part1 = document.getElementById('part-1');
  var part2 = document.getElementById('part-2');
  var btnClear = document.getElementById('btn-clear');
  var btnNext = document.getElementById('btn-next');
  var questionSection = document.getElementById('question-section');
  var screenLock = document.getElementById('screen-lock');
  var timerBadge = document.getElementById('timer-badge');
  var timerText = document.getElementById('timer-text');
  var progressBadge = document.getElementById('progress-badge');
  var progressText = document.getElementById('progress-text');

  var currentQuestionId = null;
  var secondsRemaining = null;
  var countdownIntervalId = null;

  // ==========================================================
  // ۰. کمکی: ترتیب تصادفی گزینه‌ها (ضد حفظ‌کردن جای گزینه‌ی درست)
  // ==========================================================
  function shuffledOptionNumbers() {
    var arr = [1, 2, 3, 4];
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  // ==========================================================
  // ۱. رندر کردن سوال دریافتی از سرور روی صفحه
  // ==========================================================
  function resetBlank() {
    blank.textContent = blank.getAttribute('data-default');
    blank.classList.remove('filled');
    blank.setAttribute('data-filled', 'false');
    blank.removeAttribute('data-selected-option');
  }

  function renderQuestion(question) {
    currentQuestionId = question.id;

    part1.textContent = question.question_text_1st_part;
    part2.textContent = question.question_text_2nd_part;
    resetBlank();

    // هر بار گزینه‌ها با ترتیب تصادفی جدید روی همان ۴ جایگاه چیده می‌شوند؛
    // data-option-number روی هر جایگاه مشخص می‌کند این‌بار کدام گزینه‌ی
    // واقعی (۱ تا ۴) آنجا نشسته، تا هنگام drop همان عدد به سرور فرستاده شود.
    var order = shuffledOptionNumbers();
    options.forEach(function (optionEl, index) {
      var optionNumber = order[index];
      optionEl.setAttribute('data-option-number', String(optionNumber));
      optionEl.textContent = question['option_' + optionNumber];
    });

    progressText.textContent =
      'سوال ' + question.position + ' از ' + question.total_questions;
    progressBadge.hidden = false;

    questionSection.classList.remove('correct-answer', 'wrong-answer');
  }

  // ==========================================================
  // ۲. ارتباط با سرور: گرفتن سوال بعدی
  // ==========================================================
  // به جای اینکه خود game.js حساب کند "الان روی کدام سوالیم"، هر بار از
  // سرور می‌پرسد. یعنی با رفرش صفحه هم دقیقاً از همان‌جا که مانده ادامه
  // پیدا می‌کند، چون موقعیت واقعی در جدول student_answers نگه داشته می‌شود
  // نه در حافظه‌ی مرورگر.
  function redirectByStatus(status) {
    window.location.href = status === 'finished' ? LEADERBOARD_URL : LOBBY_URL;
  }

  function loadNextQuestion() {
    screenLock.hidden = false;

    fetch('/api/game/next-question', { credentials: 'same-origin' })
      .then(function (response) {
        if (response.status === 401) {
          window.location.href = LOBBY_URL;
          return null;
        }
        if (response.status === 403) {
          return fetch('/api/lobby/status', { credentials: 'same-origin' })
            .then(function (r) { return r.ok ? r.json() : { status: 'waiting' }; })
            .then(function (state) {
              redirectByStatus(state.status);
              return null;
            });
        }
        if (response.status === 404) {
          // همه سوالات جواب داده شده‌اند
          window.location.href = LEADERBOARD_URL;
          return null;
        }
        if (!response.ok) {
          throw new Error('unexpected status ' + response.status);
        }
        return response.json();
      })
      .then(function (question) {
        if (!question) return; // یکی از حالت‌های بالا رخ داده و ریدایرکت شده
        renderQuestion(question);
        screenLock.hidden = true;
      })
      .catch(function (err) {
        console.error('خطا در دریافت سوال:', err);
        screenLock.hidden = true;
        alert('ارتباط با سرور برقرار نشد. لطفاً اتصال اینترنت را بررسی و صفحه را رفرش کن.');
      });
  }

  // ==========================================================
  // ۳. ارسال پاسخ به سرور
  // ==========================================================
  function submitAnswer(questionId, selectedOption) {
    return fetch('/api/game/answer', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question_id: questionId,
        selected_option: Number(selectedOption),
      }),
    }).then(function (response) {
      if (response.status === 401) {
        window.location.href = LOBBY_URL;
        return null;
      }
      if (response.status === 409) {
        // این سوال قبلاً جواب داده شده (مثلاً به خاطر دو تب باز)؛
        // به جای گیر کردن روی همین سوال، سراغ سوال بعدی می‌رویم
        return null;
      }
      if (!response.ok) {
        throw new Error('unexpected status ' + response.status);
      }
      return response.json();
    });
  }

  // ==========================================================
  // ۴. شمارنده معکوس زمان بازی
  // ==========================================================
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
    timerBadge.classList.toggle('timer-warning', secondsRemaining <= 30);
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

  function syncTimeRemaining() {
    fetch('/api/game/time-remaining', { credentials: 'same-origin' })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (data) {
        if (!data) return;
        if (data.status !== 'playing') {
          if (countdownIntervalId) clearInterval(countdownIntervalId);
          redirectByStatus(data.status);
          return;
        }
        if (typeof data.seconds_remaining === 'number') {
          startLocalCountdown(data.seconds_remaining);
        } else {
          timerBadge.hidden = true; // زمان‌بندی برای این بازی تعریف نشده
        }
      })
      .catch(function (err) {
        console.error('خطا در همگام‌سازی شمارنده زمان:', err);
      });
  }

// ==========================================================
// ۵. تنظیمات Drag & Drop (Pointer Events)
// ==========================================================
var activeDrag = null; // { optionEl, ghostEl, offsetX, offsetY }

function createGhost(optionEl) {
  var rect = optionEl.getBoundingClientRect();
  var ghost = optionEl.cloneNode(true);
  ghost.classList.remove('dragging');
  ghost.classList.add('option-ghost');
  ghost.style.position = 'fixed';
  ghost.style.left = rect.left + 'px';
  ghost.style.top = rect.top + 'px';
  ghost.style.width = rect.width + 'px';
  ghost.style.height = rect.height + 'px';
  ghost.style.margin = '0';
  document.body.appendChild(ghost);
  return ghost;
}

function isOverBlank(clientX, clientY) {
  var rect = blank.getBoundingClientRect();
  return (
    clientX >= rect.left && clientX <= rect.right &&
    clientY >= rect.top && clientY <= rect.bottom
  );
}

function endDrag(option, e) {
  if (!activeDrag || activeDrag.optionEl !== option) return;

  blank.classList.remove('drag-over');
  activeDrag.ghostEl.remove();
  option.classList.remove('dragging');

  if (isOverBlank(e.clientX, e.clientY)) {
    var optionNumber = option.getAttribute('data-option-number');
    blank.textContent = option.textContent;
    blank.classList.add('filled');
    blank.setAttribute('data-filled', 'true');
    blank.setAttribute('data-selected-option', optionNumber);
  }

  activeDrag = null;
}

options.forEach(function (option) {
  option.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();

    var rect = option.getBoundingClientRect();
    activeDrag = {
      optionEl: option,
      ghostEl: createGhost(option),
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };
    option.classList.add('dragging');
    option.setPointerCapture(e.pointerId);
  });

  option.addEventListener('pointermove', function (e) {
    if (!activeDrag || activeDrag.optionEl !== option) return;
    activeDrag.ghostEl.style.left = (e.clientX - activeDrag.offsetX) + 'px';
    activeDrag.ghostEl.style.top = (e.clientY - activeDrag.offsetY) + 'px';
    blank.classList.toggle('drag-over', isOverBlank(e.clientX, e.clientY));
  });

  option.addEventListener('pointerup', function (e) { endDrag(option, e); });
  option.addEventListener('pointercancel', function (e) { endDrag(option, e); });
});  // ==========================================================
  // ۶. دکمه «پاک کردن»
  // ==========================================================
  btnClear.addEventListener('click', function () {
    resetBlank();
  });

  // ==========================================================
  // ۷. دکمه «ثبت پاسخ»
  // ==========================================================
  btnNext.addEventListener('click', function () {
    var isFilled = blank.getAttribute('data-filled') === 'true';
    if (!isFilled) {
      alert('ابتدا یک گزینه را در جای خالی قرار دهید.');
      return;
    }

    var selectedOption = blank.getAttribute('data-selected-option');
    var questionId = currentQuestionId;

    screenLock.hidden = false;

    submitAnswer(questionId, selectedOption)
      .then(function (result) {
        if (!result) {
          // ۴۰۱ یا ۴۰۹ — یا ریدایرکت شده، یا فقط باید سوال بعدی را بگیریم
          screenLock.hidden = true;
          loadNextQuestion();
          return;
        }

        // فلش تمام‌صفحه: کلاس روی خود screen-lock می‌رود چون همین
        // المان از قبل کل ویوپورت را می‌پوشاند و در همین ۲ ثانیه قفل
        // است، پس همان یک overlay هم رنگ می‌شود هم کلیک‌ها را می‌بندد.
        screenLock.classList.add(result.is_correct ? 'correct-answer' : 'wrong-answer');

        setTimeout(function () {
          screenLock.classList.remove('correct-answer', 'wrong-answer');
          loadNextQuestion();
        }, FEEDBACK_DELAY_MS);
      })
      .catch(function (err) {
        console.error('خطا در ثبت پاسخ:', err);
        screenLock.hidden = true;
        alert('ارتباط با سرور برقرار نشد. لطفاً اتصال اینترنت را بررسی کن.');
      });
  });

  // ==========================================================
  // شروع: اولین سوال + شمارنده زمان
  // ==========================================================
  loadNextQuestion();
  syncTimeRemaining();
  setInterval(syncTimeRemaining, TIME_SYNC_INTERVAL_MS);
});
