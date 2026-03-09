export function renderPlanBlock(card, lpName, ents, force = false, deps) {
  const { isOn, stateVal, unitStr } = deps;
  const hasVehicle = !!ents.vehicle_soc;
  const planActive = ents.plan_active ? isOn(card._hass, ents.plan_active) : false;
  const planTime = ents.effective_plan_time
    ? stateVal(card._hass, ents.effective_plan_time) : null;
  const planSoc = ents.effective_plan_soc
    ? stateVal(card._hass, ents.effective_plan_soc) : null;
  const projStart = ents.plan_projected_start
    ? stateVal(card._hass, ents.plan_projected_start) : null;
  const projEnd = ents.plan_projected_end
    ? stateVal(card._hass, ents.plan_projected_end) : null;

  if (!ents.effective_plan_soc || !card._hass.states[ents.effective_plan_soc]) return "";
  if (!force && !hasVehicle && !planActive) return "";

  if (!card._planState[lpName]) {
    const initSoc = (planSoc && planSoc !== "unknown" && planSoc !== "unavailable")
      ? Math.round(parseFloat(planSoc)) : 80;
    let initDt = "";
    if (planTime && planTime !== "unknown" && planTime !== "unavailable") {
      try {
        const d = new Date(planTime);
        const offset = d.getTimezoneOffset() * 60000;
        initDt = new Date(d - offset).toISOString().slice(0, 16);
      } catch (e) {}
    }
    if (!initDt) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(7, 0, 0, 0);
      const offset = tomorrow.getTimezoneOffset() * 60000;
      initDt = new Date(tomorrow - offset).toISOString().slice(0, 16);
    }
    card._planState[lpName] = { soc: initSoc, time: initDt, vehicle: null };
  }

  const defaultSoc = card._planState[lpName].soc;
  const defaultDt = card._planState[lpName].time;

  const vehicleEntityId = ents.vehicle_name || null;
  const vehicleAttrs = vehicleEntityId ? (card._hass.states[vehicleEntityId]?.attributes ?? {}) : {};
  const allOptions = (vehicleAttrs.options ?? []).filter(o => o !== "null" && o !== "");
  const vehicleAttr = vehicleAttrs.vehicle ?? null;

  const dbIdToName = {};
  if (vehicleAttr?.evccName && vehicleAttr?.name) {
    dbIdToName[vehicleAttr.evccName] = vehicleAttr.name;
  }
  allOptions.forEach(id => { if (!dbIdToName[id]) dbIdToName[id] = id; });

  if (!card._planState[lpName].vehicle && vehicleAttr?.evccName) {
    card._planState[lpName].vehicle = vehicleAttr.evccName;
  }
  const defaultVehicle = card._planState[lpName].vehicle;

  const vehicleSelectHtml = allOptions.length > 0 ? `
      <div class="plan-row">
        <label>${card._t("vehicle")}</label>
        <select class="plan-vehicle-select" data-lp="${lpName}" data-entity="${vehicleEntityId ?? ""}">
          ${allOptions.map(id => `
            <option value="${id}" ${id === defaultVehicle ? "selected" : ""}>${dbIdToName[id]}</option>
          `).join("")}
        </select>
      </div>` : "";

  const startStr = card._formatDateTime(projStart);
  const endStr = card._formatDateTime(projEnd);

  const planBadge = planActive
    ? `<span class="plan-badge active">${card._t("chargingByPlan")}</span>`
    : (planTime && planTime !== "unknown" && planTime !== "unavailable")
      ? `<span class="plan-badge planned">${card._t("planned")}</span>`
      : `<span class="plan-badge">${card._t("noPlan")}</span>`;

  const projectionHtml = (startStr || endStr) ? `
      <div class="plan-projection">
        ${startStr ? `<span style="display:flex;align-items:center;gap:4px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M16.06,3.5L17.5,2.08L18.92,3.5L17.5,4.92L16.06,3.5M7.06,3.5L5.64,2.08L4.22,3.5L5.64,4.92L7.06,3.5M12,6A4,4 0 0,1 16,10V16H13V22H11V16H8V10A4,4 0 0,1 12,6Z"/></svg> ${card._t("planStart")}: <strong>${startStr}</strong></span>` : ""}
        ${endStr ? `<span>✅ ${card._t("planEnd")}: <strong>${endStr}</strong></span>` : ""}
      </div>` : "";

  return `
      <div class="plan-block" data-lp="${lpName}">
        <div class="plan-header">
          <span class="session-title">${card._t("chargePlan")}</span>
          ${planBadge}
        </div>
        ${projectionHtml}
        <div class="plan-inputs">
          ${vehicleSelectHtml}
          <div class="plan-row">
            <label>${card._t("finishBy")}</label>
            <input type="datetime-local" class="plan-time-input"
                   value="${defaultDt}" data-lp="${lpName}" />
          </div>
          <div class="plan-row">
            <label>${card._t("targetSoc")}</label>
            <div class="plan-soc-control">
              <input type="range" class="plan-soc-range"
                     min="20" max="100" step="5" value="${defaultSoc}"
                     data-lp="${lpName}" />
              <span class="plan-soc-val">${defaultSoc} %</span>
            </div>
          </div>
        </div>
        <div class="plan-actions">
          <button class="plan-btn save" data-lp="${lpName}">${card._t("setPlan")}</button>
          ${(planActive || (planTime && planTime !== "unknown" && planTime !== "unavailable"))
            ? `<button class="plan-btn delete" data-lp="${lpName}">${card._t("deletePlan")}</button>`
            : ""}
        </div>
      </div>
    `;
}

export function renderSessionInfo(card, ents, deps) {
  const { stateVal, unitStr } = deps;
  const hasAny = ents.session_energy || ents.session_price || ents.charge_duration;
  if (!hasAny) return "";

  const energy = ents.session_energy
    ? (() => {
        const v = parseFloat(stateVal(card._hass, ents.session_energy));
        return isNaN(v) ? "—" : `${v.toFixed(2)} kWh`;
      })() : null;

  const price = ents.session_price
    ? (() => {
        const v = parseFloat(stateVal(card._hass, ents.session_price));
        const unit = unitStr(card._hass, ents.session_price) || "€";
        return isNaN(v) ? "—" : `${v.toFixed(2)} ${unit}`;
      })() : null;

  const duration = ents.charge_duration
    ? (() => {
        const raw = stateVal(card._hass, ents.charge_duration);
        let totalSec;
        if (raw && raw.includes(":")) {
          const parts = raw.split(":").map(Number);
          totalSec = parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
        } else {
          totalSec = parseFloat(raw) || 0;
        }
        const h = Math.floor(totalSec / 3600);
        const min = Math.floor((totalSec % 3600) / 60);
        if (h > 0) return `${h} h ${min} min`;
        if (min > 0) return `${min} min`;
        return `< 1 min`;
      })() : null;

  const phases = ents.phases_active
    ? stateVal(card._hass, ents.phases_active) : null;

  const items = [
    energy ? `<div class="session-item"><span class="si-label">${card._t("energy")}</span><span class="si-value">${energy}</span></div>` : "",
    price ? `<div class="session-item"><span class="si-label">${card._t("cost")}</span><span class="si-value">${price}</span></div>` : "",
    duration ? `<div class="session-item"><span class="si-label">${card._t("duration")}</span><span class="si-value">${duration}</span></div>` : "",
    phases ? `<div class="session-item"><span class="si-label">${card._t("phases")}</span><span class="si-value">${phases}</span></div>` : "",
  ].filter(Boolean);

  return `
      <div class="session-block">
        <div class="session-title">${card._t("chargeSession")}</div>
        <div class="session-grid">${items.join("")}</div>
      </div>
    `;
}

export function renderPlanMode(card, loadpoints, deps) {
  if (Object.keys(loadpoints).length === 0) return card._renderEmpty(loadpoints);
  return Object.entries(loadpoints).map(([lpName, ents]) => {
    const planHtml = renderPlanBlock(card, lpName, ents, true, deps);
    const sessionHtml = renderSessionInfo(card, ents, deps);
    if (!planHtml) return "";
    return `
        <div class="loadpoint">
          <div class="lp-header">
            <span class="lp-name">${lpName}</span>
          </div>
          ${planHtml}
          ${sessionHtml}
        </div>`;
  }).join("");
}
