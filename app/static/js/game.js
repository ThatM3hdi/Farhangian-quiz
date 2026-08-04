document.addEventListener("DOMContentLoaded", function () {
  const options = document.querySelectorAll('.option-item');
  const blank = document.getElementById('blank');
  const btnClear = document.getElementById('btn-clear');
  const btnNext = document.getElementById('btn-next');
  const questionSection = document.getElementById('question-section');
  const screenLock = document.getElementById('screen-lock');

  let draggedValue = null;

  // 1. تنظیمات Drag برای گزینه‌ها
  options.forEach(option => {
    option.addEventListener('dragstart', function (e) {
      draggedValue = e.target.getAttribute('data-value');
      e.dataTransfer.setData('text/plain', draggedValue);
      // برای اینکه المان اصلی در حین کشیده شدن کمی شفاف شود
      setTimeout(() => e.target.classList.add('dragging'), 0);
    });

    option.addEventListener('dragend', function (e) {
      e.target.classList.remove('dragging');
      draggedValue = null;
    });
  });

  // 2. تنظیمات Drop برای جای خالی (...)
  blank.addEventListener('dragover', function (e) {
    e.preventDefault(); // برای اجازه دادن به Drop الزامی است
    blank.classList.add('drag-over');
  });

  blank.addEventListener('dragleave', function (e) {
    blank.classList.remove('drag-over');
  });

  blank.addEventListener('drop', function (e) {
    e.preventDefault();
    blank.classList.remove('drag-over');
    
    const data = e.dataTransfer.getData('text/plain');
    if (data) {
      blank.textContent = data;
      blank.classList.add('filled');
      blank.setAttribute('data-filled', 'true');
    }
  });

  // 3. دکمه "پاک کردن"
  btnClear.addEventListener('click', function () {
    blank.textContent = blank.getAttribute('data-default');
    blank.classList.remove('filled');
    blank.setAttribute('data-filled', 'false');
  });

  // 4. دکمه "سوال بعدی" (شبیه‌سازی ارسال و فیدبک)
  btnNext.addEventListener('click', function () {
    const isFilled = blank.getAttribute('data-filled') === 'true';
    
    if (!isFilled) {
      alert("ابتدا یک گزینه را در جای خالی قرار دهید.");
      return;
    }

    // قفل کردن کلیک‌های کل صفحه
    screenLock.hidden = false;

    // بررسی جواب کاربر (به صورت آزمایشی "گوهر" جواب درست است)
    const userAnswer = blank.textContent;
    const isCorrect = (userAnswer === 'گوهر');

    // اعمال فیدبک بصری (سبز یا قرمز شدن پس‌زمینه)
    if (isCorrect) {
      questionSection.classList.add('correct-answer');
    } else {
      questionSection.classList.add('wrong-answer');
    }

    // صبر کردن به مدت ۲ ثانیه برای نمایش رنگ
    setTimeout(() => {
      // 1. حذف افکت‌های رنگی
      questionSection.classList.remove('correct-answer', 'wrong-answer');
      
      // 2. باز کردن قفل صفحه
      screenLock.hidden = true;
      
      // 3. شبیه‌سازی رفتن به سوال بعدی (ریست کردن جای خالی)
      blank.textContent = blank.getAttribute('data-default');
      blank.classList.remove('filled');
      blank.setAttribute('data-filled', 'false');
      
      /* 
       در نسخه نهایی، اینجا کدهای Fetch قرار می‌گیرد تا سوال بعدی را 
       از سرور لود کند و متن HTML را با سوال و گزینه‌های جدید آپدیت کند.
       و اگر سوالی نمانده بود:
       window.location.href = 'leaderboard.html';
      */
      
    }, 2000);
  });
});
