(function () {
  var summary = document.querySelector('.error-summary');
  if (summary && !summary.hidden) summary.focus();

  var form = document.querySelector('[data-lab-form]');
  if (!form) return;
  form.noValidate = true;

  var start = form.querySelector('#startTime');
  var end = form.querySelector('#endTime');
  var lab = form.querySelector('#labId');
  var dateInput = form.querySelector('#date');
  var labRule = document.querySelector('#lab-rule');
  var shortNotice = document.querySelector('#short-notice');
  var classConflict = document.querySelector('#class-conflict');
  var conflictTimer = 0;
  var maxDuration = Number(form.getAttribute('data-max-duration') || '240');
  var timeZone = form.getAttribute('data-timezone') || 'America/Chicago';
  var dateError = form.getAttribute('data-date-error') || 'Choose a date at least one business day ahead. Saturday and Sunday are not available.';
  var fields = ['studentName', 'studentId', 'studentEmail', 'classId', 'instructorId', 'labId', 'date', 'startTime', 'endTime', 'notes'];

  function minutes(value) {
    var parts = String(value || '').split(':');
    return Number(parts[0]) * 60 + Number(parts[1]);
  }

  function formatDuration(total) {
    var hours = Math.floor(total / 60);
    var mins = total % 60;
    var parts = [];
    if (hours) parts.push(hours + ' hour' + (hours === 1 ? '' : 's'));
    if (mins) parts.push(mins + ' minute' + (mins === 1 ? '' : 's'));
    return parts.join(' ') || '0 minutes';
  }

  function weekday(iso) {
    var parts = String(iso || '').split('-');
    if (parts.length !== 3) return -1;
    var date = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
    if (Number.isNaN(date.getTime())) return -1;
    return date.getUTCDay();
  }

  function longDate(iso) {
    var parts = String(iso || '').split('-');
    var date = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  }

  function zoneOffsetMs(zone, date) {
    var fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    var parts = {};
    fmt.formatToParts(date).forEach(function (part) {
      parts[part.type] = part.value;
    });
    return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second)) - date.getTime();
  }

  function wallTimeMs(iso, hhmm) {
    var dateParts = String(iso || '').split('-');
    var timeParts = String(hhmm || '').split(':');
    if (dateParts.length !== 3 || timeParts.length < 2) return null;
    var utcGuess = Date.UTC(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]), Number(timeParts[0]), Number(timeParts[1]), 0);
    var offset = zoneOffsetMs(timeZone, new Date(utcGuess));
    var utc = utcGuess - offset;
    var adjusted = zoneOffsetMs(timeZone, new Date(utc));
    if (adjusted !== offset) utc = utcGuess - adjusted;
    return utc;
  }

  function syncEnd() {
    if (!start || !end) return;
    var startValue = start.value;
    if (!startValue) {
      for (var i = 0; i < end.options.length; i += 1) {
        end.options[i].disabled = false;
        end.options[i].hidden = false;
      }
      return;
    }
    for (var j = 0; j < end.options.length; j += 1) {
      var option = end.options[j];
      if (!option.value) continue;
      var diff = minutes(option.value) - minutes(startValue);
      var invalid = diff <= 0 || diff > maxDuration;
      option.disabled = invalid;
      option.hidden = invalid;
    }
    var selected = end.options[end.selectedIndex];
    if (selected && selected.disabled) end.value = '';
  }

  function syncLab() {
    if (!lab || !labRule) return;
    var option = lab.options[lab.selectedIndex];
    var text = option ? option.getAttribute('data-rule') || '' : '';
    labRule.hidden = !text;
    labRule.textContent = text;
  }

  function syncConflict() {
    if (!classConflict) return;
    var labId = valueOf('labId');
    var date = valueOf('date');
    var startValue = valueOf('startTime');
    var endValue = valueOf('endTime');
    if (!labId || !date || !startValue || !endValue || minutes(endValue) <= minutes(startValue)) {
      classConflict.hidden = true;
      return;
    }
    window.clearTimeout(conflictTimer);
    conflictTimer = window.setTimeout(function () {
      var params = new URLSearchParams({ labId: labId, date: date, startTime: startValue, endTime: endValue });
      var conflictsUrl = form.getAttribute('data-conflicts-url') || '/conflicts';
      fetch(conflictsUrl + '?' + params.toString(), { headers: { accept: 'application/json' } })
        .then(function (response) {
          if (!response.ok) throw new Error('lookup failed');
          return response.json();
        })
        .then(function (body) {
          var lines = body && Array.isArray(body.conflicts) ? body.conflicts : [];
          var note = classConflict.querySelector('p');
          var list = classConflict.querySelector('ul');
          if (!note || !list) return;
          list.textContent = '';
          if (lines.length) {
            classConflict.classList.remove('class-clear');
            classConflict.classList.add('class-conflict');
            note.textContent = classConflict.getAttribute('data-conflict-note') || '';
            lines.forEach(function (line) {
              var item = document.createElement('li');
              item.textContent = line;
              list.appendChild(item);
            });
            list.hidden = false;
          } else {
            classConflict.classList.remove('class-conflict');
            classConflict.classList.add('class-clear');
            note.textContent = classConflict.getAttribute('data-clear-note') || '';
            list.hidden = true;
          }
          classConflict.hidden = false;
        })
        .catch(function () {});
    }, 150);
  }

  function syncShortNotice() {
    if (!shortNotice) return;
    var date = valueOf('date');
    var startValue = valueOf('startTime');
    var startMs = wallTimeMs(date, startValue);
    var soon = startMs !== null && startMs - Date.now() < 24 * 60 * 60 * 1000;
    shortNotice.hidden = !soon;
  }

  function collect() {
    var errors = {};
    var name = valueOf('studentName');
    if (!name) errors.studentName = 'Enter your name.';
    else if (name.length > 80 || !/^[\p{L}][\p{L}\p{M}'. -]{0,79}$/u.test(name)) {
      errors.studentName = 'Enter your name using letters, spaces, hyphens, apostrophes, or periods (up to 80 characters).';
    }

    var studentId = valueOf('studentId');
    if (!studentId) errors.studentId = 'Enter your S-ID.';
    else if (!/^[A-Za-z0-9]{4,16}$/.test(studentId)) errors.studentId = 'Enter an S-ID of 4–16 letters or numbers.';

    var email = valueOf('studentEmail');
    if (!email) errors.studentEmail = 'Enter your email address.';
    else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.studentEmail = 'Enter a valid email address.';

    if (!valueOf('classId')) errors.classId = 'Choose your class.';
    if (!valueOf('instructorId')) errors.instructorId = 'Choose your instructor.';
    if (!valueOf('labId')) errors.labId = 'Choose a lab or trainer.';

    var date = valueOf('date');
    var day = weekday(date);
    if (!date) errors.date = 'Choose a date.';
    else if (day < 0) errors.date = 'Choose a valid date.';
    else if (day === 0 || day === 6 || (dateInput && dateInput.min && date < dateInput.min)) errors.date = dateError;
    else if (dateInput && dateInput.max && date > dateInput.max) errors.date = 'Choose a date on or before ' + longDate(dateInput.max) + '.';

    var startValue = valueOf('startTime');
    var endValue = valueOf('endTime');
    if (!startValue) errors.startTime = 'Choose a start time.';
    if (!endValue) errors.endTime = 'Choose an end time.';
    else if (startValue) {
      var span = minutes(endValue) - minutes(startValue);
      if (span <= 0) errors.endTime = 'Choose an end time after the start time.';
      else if (span > maxDuration) errors.endTime = 'Choose a time span of ' + formatDuration(maxDuration) + ' or less.';
    }

    if (valueOf('notes').length > 1000) errors.notes = 'Keep notes to 1000 characters.';
    return errors;
  }

  function valueOf(id) {
    var field = document.getElementById(id);
    return field ? String(field.value || '').trim() : '';
  }

  function show(errors) {
    var box = document.querySelector('.error-summary');
    if (!box) return;
    var list = box.querySelector('ul');
    list.textContent = '';
    fields.forEach(function (id) {
      var message = errors[id];
      var note = document.getElementById(id + '-error');
      var field = document.getElementById(id);
      if (message) {
        var item = document.createElement('li');
        var link = document.createElement('a');
        link.href = '#' + id;
        link.textContent = message;
        item.appendChild(link);
        list.appendChild(item);
        if (note) {
          note.hidden = false;
          note.textContent = message;
        }
        if (field) field.setAttribute('aria-invalid', 'true');
      } else {
        if (note) {
          note.hidden = true;
          note.textContent = '';
        }
        if (field) field.setAttribute('aria-invalid', 'false');
      }
    });
    box.hidden = false;
    box.focus();
  }

  if (start) start.addEventListener('change', function () {
    syncEnd();
    syncShortNotice();
    syncConflict();
  });
  if (end) end.addEventListener('change', function () {
    syncEnd();
    syncConflict();
  });
  if (lab) lab.addEventListener('change', function () {
    syncLab();
    syncConflict();
  });
  if (dateInput) {
    dateInput.addEventListener('change', function () {
      syncShortNotice();
      syncConflict();
    });
    dateInput.addEventListener('input', function () {
      syncShortNotice();
      syncConflict();
    });
  }
  syncEnd();
  syncLab();
  syncShortNotice();
  syncConflict();

  form.addEventListener('submit', function (event) {
    var errors = collect();
    if (Object.keys(errors).length) {
      event.preventDefault();
      show(errors);
      return;
    }
    var button = form.querySelector('[type="submit"]');
    if (button) {
      button.disabled = true;
      button.textContent = 'Submitting…';
    }
  });
})();

(function () {
  var form = document.querySelector('[data-reply-form]');
  if (!form) return;
  var note = form.querySelector('#note');
  var flag = form.querySelector('#note-flag');
  var radios = form.querySelectorAll('input[name="action"]');

  function otherSelected() {
    var other = form.querySelector('input[name="action"][value="other"]');
    return Boolean(other && other.checked);
  }

  function syncNote() {
    var required = otherSelected();
    if (note) note.required = required;
    if (flag) flag.textContent = required ? '(required)' : '(optional)';
  }

  radios.forEach(function (radio) {
    radio.addEventListener('change', syncNote);
  });
  syncNote();

  form.addEventListener('submit', function (event) {
    if (!otherSelected() || !note || note.value.trim()) return;
    event.preventDefault();
    var error = form.querySelector('#note-error');
    if (error) {
      error.hidden = false;
      error.textContent = 'Write a message when you choose Other.';
    }
    note.focus();
  });
})();
