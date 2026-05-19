(function () {
  // ───────── 상수 ─────────
  const SOURCE_ID = 'bwrk_tm_mon_rm';   // 월 잔여 근무시간이 들어있는 p
  const ANCHOR_ID = 'bwrk_tm_mon_ag';   // 출력 위치 기준 p
  const BOX_ID = 'ext-overlay-box';
  const BR_ID = 'ext-overlay-br';

  const STORAGE_KEY = 'standardDailyHours';
  const DEFAULT_DAILY_HOURS = 8;
  const ERROR_GRACE_MS = 5000;          // 페이지 로딩 직후 에러 표시 유예 시간

  const COLOR_LATE = '#fff176';   // 노랑: 추가 근무 필요 (주의)
  const COLOR_EARLY = '#a5d6a7';  // 초록: 조기 퇴근 가능 (긍정)
  const COLOR_ERROR = '#ffcdd2';  // 분홍: 데이터 추출 실패

  let standardDailyHours = DEFAULT_DAILY_HOURS;
  let allowError = false;

  // ───────── 데이터 추출 ─────────

  function getRemainingMinutes() {
    const el = document.getElementById(SOURCE_ID);
    if (!el) return null;
    const m = el.textContent.match(/(\d+)\s*시간\s*(\d+)\s*분/);
    return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
  }

  // 캘린더에서 오늘(k-today) 포함 이후의 근무일 수.
  // 평일 근무 셀은 class가 빈 문자열 또는 'k-today'만 해당.
  // (k-other-month / k-weekend / dews-holiday 는 제외)
  function countRemainingWorkdays() {
    const cells = [...document.querySelectorAll('td[role="gridcell"]')];
    const todayIdx = cells.findIndex(td => td.className.trim() === 'k-today');
    if (todayIdx === -1) return 0;
    return cells.slice(todayIdx).filter(td => {
      const cls = td.className.trim();
      return cls === '' || cls === 'k-today';
    }).length;
  }

  // 분 → { sign, h, m } (음수/60분 캐리 처리)
  function splitMinutes(min) {
    const sign = min < 0 ? '-' : '';
    const abs = Math.abs(min);
    let h = Math.floor(abs / 60);
    let m = Math.round(abs - h * 60);
    if (m === 60) { h += 1; m = 0; }
    return { sign, h, m };
  }

  // ───────── DOM 노드 빌더 ─────────

  function makeChip(text, bg) {
    const span = document.createElement('span');
    span.style.cssText =
      `background-color:${bg};color:#000;font-weight:bold;` +
      `padding:1px 6px;border-radius:3px;font-size:1.05em`;
    span.textContent = text;
    return span;
  }

  function buildResult() {
    const remainMin = getRemainingMinutes();
    if (remainMin === null) return { kind: 'error', reason: 'no-source' };

    const days = countRemainingWorkdays();
    if (days === 0) return { kind: 'error', reason: 'no-days' };

    const perDayMin = (remainMin - days * standardDailyHours * 60) / days;
    const { sign, h, m } = splitMinutes(perDayMin);
    const timeStr = h === 0 ? `${m}분` : `${h}시간 ${m}분`;
    const bg = sign === '-' ? COLOR_EARLY : COLOR_LATE;
    const verb = sign === '-' ? '일찍 퇴근해도 됩니다' : '늦게 퇴근하면 됩니다';

    const frag = document.createDocumentFragment();
    frag.append(makeChip(`${days}일`, bg));
    frag.append('간 ');
    frag.append(makeChip(timeStr, bg));
    frag.append(`씩 ${verb}.`);
    return { kind: 'ok', frag };
  }

  function buildErrorFragment(reason) {
    const frag = document.createDocumentFragment();
    frag.append(makeChip('!', COLOR_ERROR));
    frag.append(' ');
    const text = reason === 'no-source'
      ? '월 잔여 근무시간 정보를 찾지 못했습니다. (페이지 구조가 변경되었을 수 있습니다)'
      : '남은 근무일을 계산하지 못했습니다.';
    const span = document.createElement('span');
    span.style.cssText = 'color:#000;font-size:0.95em';
    span.textContent = text;
    frag.append(span);
    return frag;
  }

  // ───────── 렌더링 ─────────

  // anchor 다음에 <br> + <p>를 삽입. 이미 올바른 위치에 있으면 그대로 사용.
  function placeBox(anchor) {
    let box = document.getElementById(BOX_ID);
    let br = document.getElementById(BR_ID);

    const placed = box && br
      && br.previousElementSibling === anchor
      && box.previousElementSibling === br;

    if (!placed) {
      if (box) box.remove();
      if (br) br.remove();

      br = document.createElement('br');
      br.id = BR_ID;
      box = document.createElement('p');
      box.id = BOX_ID;
      box.className = 'legend_title4';

      anchor.insertAdjacentElement('afterend', br);
      br.insertAdjacentElement('afterend', box);
    }
    return box;
  }

  function setChildren(box, fragment) {
    while (box.firstChild) box.removeChild(box.firstChild);
    box.append(fragment);
  }

  function render() {
    const anchor = document.getElementById(ANCHOR_ID);
    if (!anchor) return;

    const result = buildResult();
    if (result.kind === 'error' && !allowError) return;

    const box = placeBox(anchor);
    setChildren(
      box,
      result.kind === 'ok' ? result.frag : buildErrorFragment(result.reason)
    );
  }

  // ───────── 초기화 ─────────

  // anchor/source는 비동기로 그려질 수 있고, SPA 라우팅으로 다시 사라졌다
  // 나타날 수도 있어 observer는 disconnect하지 않고 유지한다.
  function setupObserver() {
    render();

    setTimeout(() => {
      allowError = true;
      render();
    }, ERROR_GRACE_MS);

    let pending = false;
    const observer = new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        render();
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !changes[STORAGE_KEY]) return;
    const v = parseFloat(changes[STORAGE_KEY].newValue);
    standardDailyHours = (isFinite(v) && v > 0) ? v : DEFAULT_DAILY_HOURS;
    render();
  });

  chrome.storage.sync.get({ [STORAGE_KEY]: DEFAULT_DAILY_HOURS }, (data) => {
    const v = parseFloat(data[STORAGE_KEY]);
    standardDailyHours = (isFinite(v) && v > 0) ? v : DEFAULT_DAILY_HOURS;
    setupObserver();
  });
})();
