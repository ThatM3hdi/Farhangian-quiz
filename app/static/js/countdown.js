document.addEventListener("DOMContentLoaded", () => {
    const timeDisplay = document.getElementById("time-display");
    const toggleBtn = document.getElementById("toggle-btn");
    const resetBtn = document.getElementById("reset-btn");
    const circle = document.querySelector(".progress-ring__circle");
    const alarmSound = document.getElementById("alarm-sound");

    // محاسبات محیط دایره برای انیمیشن SVG
    const radius = circle.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;

    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    circle.style.strokeDashoffset = 0;

    let totalTime = 30; // زمان اولیه (به ثانیه)
    let timeLeft = totalTime;
    let timerInterval = null;
    let isRunning = false;

    // تابع بروزرسانی ظاهر تایمر
    function updateDisplay() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timeDisplay.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

        // محاسبه درصد باقی‌مانده و اعمال روی مرز دایره
        const percent = timeLeft / totalTime;
        const offset = circumference - (percent * circumference);
        circle.style.strokeDashoffset = offset;

        // تغییر تدریجی رنگ از سبز به قرمز
        // در 100% کاملا سبز و در 0% کاملا قرمز
        const red = Math.floor(220 - (180 * percent));
        const green = Math.floor(53 + (150 * percent));
        circle.style.stroke = `rgb(${red}, ${green}, 69)`;
    }

    // شروع تایمر
    function startTimer() {
        if (timeLeft <= 0) return;
        isRunning = true;
        toggleBtn.textContent = "⏸"; 
        
        timerInterval = setInterval(() => {
            timeLeft--;
            updateDisplay();

            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                isRunning = false;
                toggleBtn.textContent = "▶";
                alarmSound.play(); // پخش افکت صدا
            }
        }, 1000);
    }

    // توقف تایمر
    function pauseTimer() {
        isRunning = false;
        toggleBtn.textContent = "▶";
        clearInterval(timerInterval);
    }

    // ریست تایمر
    function resetTimer() {
        pauseTimer();
        timeLeft = totalTime;
        
        // حذف موقت ترانزیشن برای برگشت سریع دایره به حالت پر
        circle.style.transition = 'none';
        updateDisplay();
        
        setTimeout(() => {
            circle.style.transition = 'stroke-dashoffset 1s linear, stroke 1s linear';
        }, 50);
    }

    // کلیک روی عدد تایمر برای تغییر زمان
    timeDisplay.addEventListener("click", () => {
        pauseTimer();
        const userInput = prompt("لطفاً زمان مورد نظر را به ثانیه وارد کنید (مثلا 60):", totalTime);
        
        if (userInput !== null && !isNaN(userInput) && parseInt(userInput) > 0) {
            totalTime = parseInt(userInput, 10);
            resetTimer(); // اعمال زمان جدید و ریست کردن دایره
        }
    });

    // مدیریت کلیک دکمه شروع/توقف
    toggleBtn.addEventListener("click", () => {
        if (isRunning) {
            pauseTimer();
        } else {
            startTimer();
        }
    });

    // مدیریت کلیک دکمه ریست
    resetBtn.addEventListener("click", resetTimer);

    // راه‌اندازی اولیه صفحه
    updateDisplay();
});