(function () {
  'use strict';

  var POLL_INTERVAL_MS = 5000;
  var MEDAL_CLASS_BY_RANK = { 1: 'gold-medal', 2: 'silver-medal', 3: 'bronze-medal' };
  var PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

  var tbody = document.getElementById('leaderboard-body');
  var lastPayload = null; // برای جلوگیری از رندر دوباره‌ی بی‌مورد وقتی چیزی عوض نشده

  function toPersianDigits(value) {
    return String(value).replace(/[0-9]/g, function (digit) {
      return PERSIAN_DIGITS[digit];
    });
  }

  function buildStatusRow(message) {
    var tr = document.createElement('tr');
    tr.className = 'status-row';

    var td = document.createElement('td');
    td.colSpan = 3;
    td.textContent = message;

    tr.appendChild(td);
    return tr;
  }

  function buildStudentRow(entry, rank) {
    var tr = document.createElement('tr');
    var medalClass = MEDAL_CLASS_BY_RANK[rank];
    if (medalClass) tr.className = medalClass;

    var rankTd = document.createElement('td');
    rankTd.className = 'col-rank';
    rankTd.textContent = toPersianDigits(rank);

    var nameTd = document.createElement('td');
    nameTd.className = 'col-name';
    nameTd.textContent = entry.name; // textContent، نه innerHTML؛ نام را کاربر وارد کرده

    var accuracyTd = document.createElement('td');
    accuracyTd.className = 'col-accuracy';
    accuracyTd.textContent =
      entry.accuracy === null || entry.accuracy === undefined
        ? '—'
        : toPersianDigits(entry.accuracy) + '٪';

    tr.appendChild(rankTd);
    tr.appendChild(nameTd);
    tr.appendChild(accuracyTd);
    return tr;
  }

  function renderLeaderboard(students) {
    tbody.innerHTML = '';

    if (!students.length) {
      tbody.appendChild(buildStatusRow('هنوز دانشجویی وارد بازی نشده است'));
      return;
    }

    students.forEach(function (entry, index) {
      tbody.appendChild(buildStudentRow(entry, index + 1));
    });
  }

  function fetchLeaderboard() {
    fetch('/api/leaderboard/')
      .then(function (response) {
        if (!response.ok) {
          throw new Error('unexpected status ' + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        var students = data.students || [];
        var serialized = JSON.stringify(students);

        // این صفحه معمولاً روی یک نمایشگر کلاس ثابت باز است؛ اگر رتبه‌بندی
        // از آخرین بار عوض نشده، دوباره کل جدول را نمی‌سازیم تا چشمک نزند.
        if (serialized === lastPayload) return;
        lastPayload = serialized;

        renderLeaderboard(students);
      })
      .catch(function (err) {
        console.error('خطا در دریافت جدول امتیازات:', err);
        // فقط وقتی هنوز هیچ داده‌ی معتبری روی صفحه نیست پیام خطا نشان بده؛
        // در غیر این صورت آخرین رتبه‌بندی معتبر همچنان روی صفحه می‌ماند
        // تا یک قطعی موقت اینترنت، نمایشگر کلاس را خالی نکند.
        if (lastPayload === null) {
          tbody.innerHTML = '';
          tbody.appendChild(buildStatusRow('ارتباط با سرور برقرار نشد، در حال تلاش مجدد...'));
        }
      });
  }

  fetchLeaderboard();
  setInterval(fetchLeaderboard, POLL_INTERVAL_MS);
})();
