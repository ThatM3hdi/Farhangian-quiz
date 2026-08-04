document.addEventListener("DOMContentLoaded", function () {
  'use strict';

  // آدرس صفحه لیدربرد. این فایل هنوز طبق مستندات پروژه ساخته نشده؛
  // هر وقت ساختی، در صورت نیاز همین یک خط را عوض کن.
  var LEADERBOARD_URL = 'leaderboard.html';
  var LOBBY_URL = 'lobby.html';
  var FEEDBACK_DELAY_MS = 2000;

  var options = document.querySelectorAll('.option-item');
  var blank = document.getElementById('blank');
  var part1 = document.getElementById('part-1');
  var part2 = document.getElementById('part-2');
  var btnClear = document.getElementById('btn-clear');
  var btnNext = document.getElementById('btn-next');
  var questionSection = document.getElementById('question-section');
  var screenLock = document.getElementById('screen-lock');

  var draggedOptionNumber = null; // "1".."4" — همینی که سرور برای ثبت پاسخ می‌خواهد
  var currentQuestionId = null;

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

    options.forEach(function (optionEl) {
      var n = optionEl.getAttribute('data-option-number');
      optionEl.textContent = question['option_' + n];
    });

    questionSection.classList.remove('correct-answer', 'wrong-answer');
  }

  // ==========================================================
  // ۲. ارتباط با سرور: گرفتن سوال بعدی
  // ==========================================================
  // به جای اینکه خود game.js حساب کند "الان روی کدام سوالیم"، هر بار از
  // سرور می‌پرسد. یعنی با رفرش صفحه هم دقیقاً از همان‌جا که مانده ادامه
  // پیدا می‌کند، چون موقعیت واقعی در جدول student_answers نگه داشته می‌شود
  // نه در حافظه‌ی مرورگر.
  function loadNextQuestion() {
    screenLock.hidden = false;

    fetch('/api/game/next-question', { credentials: 'same-origin' })
      .then(function (response) {
        if (response.status === 401) {
          // کوکی معتبر نیست — کاربر باید دوباره از لابی وارد شود
          window.location.href = LOBBY_URL;
          return null;
        }
        if (response.status === 403) {
          // بازی الان "playing" نیست؛ ببینیم پایان یافته یا هنوز شروع نشده
          return fetch('/api/lobby/status', { credentials: 'same-origin' })
            .then(function (r) { return r.ok ? r.json() : { status: 'waiting' }; })
            .then(function (state) {
              window.location.href =
                state.status === 'finished' ? LEADERBOARD_URL : LOBBY_URL;
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
  // ۴. تنظیمات Drag & Drop
  // ==========================================================
  options.forEach(function (option) {
    option.addEventListener('dragstart', function (e) {
      draggedOptionNumber = e.target.getAttribute('data-option-number');
      e.dataTransfer.setData('text/plain', draggedOptionNumber);
      setTimeout(function () { e.target.classList.add('dragging'); }, 0);
    });

    option.addEventListener('dragend', function (e) {
      e.target.classList.remove('dragging');
      draggedOptionNumber = null;
    });
  });

  blank.addEventListener('dragover', function (e) {
    e.preventDefault();
    blank.classList.add('drag-over');
  });

  blank.addEventListener('dragleave', function () {
    blank.classList.remove('drag-over');
  });

  blank.addEventListener('drop', function (e) {
    e.preventDefault();
    blank.classList.remove('drag-over');

    var optionNumber = e.dataTransfer.getData('text/plain');
    if (!optionNumber) return;

    var sourceOption = document.querySelector(
      '.option-item[data-option-number="' + optionNumber + '"]'
    );
    blank.textContent = sourceOption ? sourceOption.textContent : '';
    blank.classList.add('filled');
    blank.setAttribute('data-filled', 'true');
    blank.setAttribute('data-selected-option', optionNumber);
  });

  // ==========================================================
  // ۵. دکمه «پاک کردن»
  // ==========================================================
  btnClear.addEventListener('click', function () {
    resetBlank();
  });

  // ==========================================================
  // ۶. دکمه «ثبت پاسخ»
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

        questionSection.classList.add(
          result.is_correct ? 'correct-answer' : 'wrong-answer'
        );

        setTimeout(function () {
          questionSection.classList.remove('correct-answer', 'wrong-answer');
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
  // شروع: اولین سوال را بگیر
  // ==========================================================
  loadNextQuestion();
});
