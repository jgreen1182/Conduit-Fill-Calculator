const conduit_db = [
    { size: 20, area_mm2: 314.16 },
    { size: 25, area_mm2: 490.87 },
    { size: 32, area_mm2: 804.25 },
    { size: 40, area_mm2: 1256.64 },
    { size: 50, area_mm2: 1963.50 },
    { size: 63, area_mm2: 3117.25 },
    { size: 80, area_mm2: 5026.55 },
    { size: 100, area_mm2: 7853.98 },
    { size: 125, area_mm2: 12271.85 },
    { size: 150, area_mm2: 17671.46 },
    { size: 200, area_mm2: 31415.93 }
];

function cableCrossSectionArea(diameter) {
    const radius = diameter / 2;
    return Math.PI * radius * radius;
}

function getSpaceFactor(numCables) {
    if (numCables === 1) return 0.5;
    if (numCables === 2) return 0.33;
    return 0.4;
}

function addCableToTable(name, diameter) {
    const tbody = document.querySelector("#cable-table tbody");
    const area = cableCrossSectionArea(diameter);

    const tr = document.createElement("tr");
    tr.innerHTML = `
    <td class="name">${name}</td>
    <td class="diameter">${diameter.toFixed(2)}</td>
    <td class="area">${area.toFixed(2)}</td>
    <td><button class="remove-btn">Remove</button></td>
  `;

    tr.querySelector(".remove-btn").addEventListener("click", () => {
        tr.remove();
        updateFillInfo();
        updateRecommendation();
        updateCanvas();
        if (document.querySelector('input[name="recommend-mode"]:checked').value === "multi") {
          distributeAndUpdateMulti();
        } else {
          clearMultiFillDisplay();
        }
    });

    tbody.appendChild(tr);
    updateFillInfo();
    updateRecommendation();
    updateCanvas();
    if (document.querySelector('input[name="recommend-mode"]:checked').value === "multi") {
      distributeAndUpdateMulti();
    } else {
      clearMultiFillDisplay();
    }
}

function updateFillInfo() {
    const cables = [...document.querySelectorAll("#cable-table tbody tr")];
    const fillInfo = document.getElementById("fill-info");
    const conduitSelect = document.getElementById("conduit-select");

    if (cables.length === 0) {
        fillInfo.textContent = "Please add cables and select conduit size.";
        return;
    }

    if (!conduitSelect.value) {
        fillInfo.textContent = "Select a conduit size to see fill ratio.";
        return;
    }

    let totalArea = 0;
    cables.forEach(row => {
        const diameter = parseFloat(row.querySelector(".diameter").textContent);
        totalArea += cableCrossSectionArea(diameter);
    });

    const conduitSize = parseInt(conduitSelect.value);
    const conduit = conduit_db.find(c => c.size === conduitSize);
    if (!conduit) return;

    const spaceFactor = getSpaceFactor(cables.length);
    const fillRatio = totalArea / conduit.area_mm2;

    const status = fillRatio <= spaceFactor ? "✅ Within Limit" : "❌ Exceeds Limit";

    fillInfo.innerHTML = `
    <div><strong>Conduit 1:</strong> Fill = ${(fillRatio * 100).toFixed(2)}%, Allowed = ${(spaceFactor * 100).toFixed(2)}% → ${status}</div>
  `;
}

function updateRecommendation() {
    const cables = [...document.querySelectorAll("#cable-table tbody tr")];
    const recommendedSpan = document.getElementById("recommended-conduit");
    const mode = document.querySelector('input[name="recommend-mode"]:checked')?.value || "single";

    if (cables.length === 0) {
        recommendedSpan.innerHTML = "None";
        return;
    }

    let totalArea = 0;
    cables.forEach(row => {
        const diameter = parseFloat(row.querySelector(".diameter").textContent);
        totalArea += cableCrossSectionArea(diameter);
    });

    const spaceFactor = getSpaceFactor(cables.length);

    if (mode === "single") {
        const minRequiredArea = totalArea / spaceFactor;
        const match = conduit_db.find(c => c.area_mm2 >= minRequiredArea);
        if (match) {
            recommendedSpan.innerHTML = `<div><strong>1 × ${match.size} mm</strong> (Area: ${match.area_mm2.toFixed(2)} mm²)</div>`;
        } else {
            recommendedSpan.innerHTML = "No suitable single conduit found.";
        }
    } else if (mode === "multi") {
        const rawResults = [];
        const totalCables = cables.length;
        let lastConduitSize = Infinity;

        for (let count = 2; count <= 5; count++) {
            const avgCablesPerConduit = Math.ceil(totalCables / count);
            const spaceFactor = getSpaceFactor(avgCablesPerConduit);
            const minAreaPerConduit = (totalArea / count) / spaceFactor;

            const conduit = conduit_db.find(c => c.area_mm2 >= minAreaPerConduit);
            if (!conduit) continue;

            if (conduit.size < lastConduitSize) {
                rawResults.push({ count, size: conduit.size, area: conduit.area_mm2 });
                lastConduitSize = conduit.size;
            } else if (conduit.size === lastConduitSize) {
                const exists = rawResults.some(r => r.size === conduit.size);
                if (!exists) {
                    rawResults.push({ count, size: conduit.size, area: conduit.area_mm2 });
                }
            } else {
                break;
            }
        }

        if (rawResults.length === 0) {
            recommendedSpan.innerHTML = "No suitable multiple conduit configuration found.";
            return;
        }

        recommendedSpan.innerHTML = rawResults.map(r =>
            `<div><strong>${r.count} × ${r.size} mm</strong> (each ${r.area.toFixed(2)} mm²)</div>`
        ).join("");
    }
}

function drawMultipleConduits(canvas, conduits, conduitSize) {
    conduits.sort((a, b) => a.id - b.id);
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const total = conduits.length;
    const padding = 30; // space between conduits, increased for more breathing room
    const conduitDiameter = conduitSize;
    const radius = conduitDiameter / 2;

    // Use 90% of canvas width and 80% of canvas height for plotting
    const maxPlotWidth = canvas.width * 0.9;
    const maxPlotHeight = canvas.height * 0.8;

    // Calculate horizontal scale based on total conduits + padding
    const scaleX = (maxPlotWidth - (total - 1) * padding) / (total * conduitDiameter);
    // Calculate vertical scale based on conduit diameter
    const scaleY = maxPlotHeight / conduitDiameter;

    // Use the smaller scale to fit conduits nicely in both directions
    const scale = Math.min(scaleX, scaleY);

    const conduitRadiusPx = radius * scale;

    // Calculate total width occupied by conduits + padding for centering
    const totalWidth = total * conduitDiameter * scale + (total - 1) * padding;
    const startX = (canvas.width - totalWidth) / 2 + conduitRadiusPx;

    const centerY = canvas.height / 2;

    conduits.forEach((conduit, i) => {
        const cx = startX + i * (conduitDiameter * scale + padding);
        const cy = centerY;

        // Draw conduit circle
        ctx.beginPath();
        ctx.arc(cx, cy, conduitRadiusPx, 0, 2 * Math.PI);
        ctx.strokeStyle = "#ff7a00"; // bright orange
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.fillStyle = "#000000"; // black title
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(`Conduit ${conduit.id}`, cx, cy - conduitRadiusPx - 10);

        // Sort cables descending diameter
        const sortedCables = [...conduit.cables].sort((a, b) => b.diameter - a.diameter);
        const placed = placeCables(sortedCables, radius);

        placed.forEach((pos, j) => {
            const cable = sortedCables[j];
            const r = (cable.diameter / 2) * scale;
            const x = cx + pos.x * scale;
            const y = cy - pos.y * scale;

            ctx.beginPath();
            ctx.arc(x, y, r, 0, 2 * Math.PI);
            ctx.fillStyle = "#ffffff";        // white inside
            ctx.fill();
            ctx.strokeStyle = "#000000";      // black outline
            ctx.lineWidth = 1.5;
            ctx.stroke();
            
            // Cable label
            ctx.fillStyle = "#000000";        // black text
            ctx.font = "12px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(cable.name, x, y);
        });
    });
}



function updateCanvas() {
    const canvas = document.getElementById("conduit-canvas");
    const conduitSelect = document.getElementById("conduit-select");
    const mode = document.querySelector('input[name="recommend-mode"]:checked')?.value || "single";
    const cables = [...document.querySelectorAll("#cable-table tbody tr")].map(row => ({
        name: row.querySelector(".name").textContent,
        diameter: parseFloat(row.querySelector(".diameter").textContent)
    }));

    if (!canvas || cables.length === 0) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = "14px sans-serif";
        ctx.fillStyle = "#999";
        ctx.textAlign = "center";
        ctx.fillText("Please add cables and select conduit size.", canvas.width / 2, canvas.height / 2);
        return;
    }

    if (mode === "single" && conduitSelect.value) {
        const conduitSize = parseInt(conduitSelect.value);
        drawConduitAndCables(canvas, conduitSize, cables);
    } else if (mode === "multi") {
        const quantity = parseInt(document.getElementById("multi-quantity").value);
        const size = parseInt(document.getElementById("multi-size").value);
        if (!quantity || !size) {
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.font = "14px sans-serif";
            ctx.fillStyle = "#999";
            ctx.textAlign = "center";
            ctx.fillText("Select quantity and size to plot multiple conduits.", canvas.width / 2, canvas.height / 2);
            return;
        }

        const conduits = distributeCablesAcrossConduits(cables, size, quantity);
        drawMultipleConduits(canvas, conduits, size);
    } else {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = "14px sans-serif";
        ctx.fillStyle = "#999";
        ctx.textAlign = "center";
        ctx.fillText("Please add cables and select conduit size.", canvas.width / 2, canvas.height / 2);
    }
}

function drawConduitAndCables(canvas, conduitDiameter, cables) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  
    // Use 90% width and 80% height of canvas for plotting
    const maxPlotWidth = canvas.width * 0.9;
    const maxPlotHeight = canvas.height * 0.8;
  
    const radius = conduitDiameter / 2;
  
    // Scale independently for width and height, choose smaller to keep circle shape
    const scaleX = maxPlotWidth / conduitDiameter;
    const scaleY = maxPlotHeight / conduitDiameter;
    const scale = Math.min(scaleX, scaleY);
  
    const conduitRadiusPx = radius * scale;
  
    // Center conduit horizontally and vertically
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
  
    // Draw conduit circle
    ctx.beginPath();
    ctx.arc(cx, cy, conduitRadiusPx, 0, 2 * Math.PI);
    ctx.strokeStyle = "#ff7a00";
    ctx.lineWidth = 4;
    ctx.stroke();
  
    // Sort cables descending diameter
    const sortedCables = [...cables].sort((a, b) => b.diameter - a.diameter);
    const placed = placeCables(sortedCables, radius);
  
    placed.forEach((pos, i) => {
      const cable = sortedCables[i];
      const r = (cable.diameter / 2) * scale;
      const x = cx + pos.x * scale;
      const y = cy - pos.y * scale;
  
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.strokeStyle = "#000000"; // black border
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }
  

function placeCables(cables, conduitRadius) {
    const placed = [];

    function doesOverlap(x, y, r) {
        for (const p of placed) {
            const dx = x - p.x;
            const dy = y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < r + p.r - 0.5) return true;
        }
        return false;
    }

    function isInside(x, y, r) {
        return Math.sqrt(x * x + y * y) + r <= conduitRadius + 0.5;
    }

    for (let i = 0; i < cables.length; i++) {
        const r = cables[i].diameter / 2;
        if (i === 0) {
            placed.push({ x: 0, y: -conduitRadius + r, r });
            continue;
        }

        let best = null;
        for (let angle = 180; angle <= 360; angle += 5) {
            const rad = (angle * Math.PI) / 180;
            const x = (conduitRadius - r) * Math.cos(rad);
            const y = (conduitRadius - r) * Math.sin(rad);
            if (isInside(x, y, r) && !doesOverlap(x, y, r)) {
                if (!best || y < best.y || (Math.abs(x) < Math.abs(best.x) && y === best.y)) {
                    best = { x, y, r };
                }
            }
        }

        for (const p of placed) {
            const dist = r + p.r;
            for (let a = 0; a < 360; a += 10) {
                const rad = (a * Math.PI) / 180;
                const x = p.x + dist * Math.cos(rad);
                const y = p.y + dist * Math.sin(rad);
                if (isInside(x, y, r) && !doesOverlap(x, y, r)) {
                    if (!best || y < best.y || (Math.abs(x) < Math.abs(best.x) && y === best.y)) {
                        best = { x, y, r };
                    }
                }
            }
        }

        if (best) placed.push(best);
        else placed.push({ x: 0, y: 0, r }); // fallback center
    }

    return placed;
}

// Distribute cables algorithm for multi-conduit
function distributeCablesAcrossConduits(cables, conduitSize, conduitCount) {
    const conduit = conduit_db.find(c => c.size === conduitSize);
    if (!conduit) return [];

    const conduits = Array.from({ length: conduitCount }, (_, i) => ({
        id: i + 1,
        cables: [],
        totalArea: 0
    }));

    // Sort cables descending by area
    const sorted = [...cables].sort((a, b) => cableCrossSectionArea(b.diameter) - cableCrossSectionArea(a.diameter));

    for (const cable of sorted) {
        const area = cableCrossSectionArea(cable.diameter);
        // Assign cable to conduit with least total area so far
        conduits.sort((a, b) => a.totalArea - b.totalArea);
        conduits[0].cables.push({ ...cable, area });
        conduits[0].totalArea += area;
    }

    return conduits.map(c => {
        const numCablesInConduit = c.cables.length;
        const spaceFactor = getSpaceFactor(numCablesInConduit);
        const fillRatio = c.totalArea / conduit.area_mm2;

        return {
            ...c,
            fillRatio,
            spaceFactor,
            conduitArea: conduit.area_mm2,
            withinLimit: fillRatio <= spaceFactor
        };
    });
}

function updateMultiFillDisplay(conduits) {
    const tbody = document.querySelector("#multi-conduit-table tbody");
    const summary = document.getElementById("multi-fill-summary");
    tbody.innerHTML = "";
    summary.innerHTML = "";

    // Sort conduits by id ascending
    conduits.sort((a, b) => a.id - b.id);

    conduits.forEach(conduit => {
        const status = conduit.withinLimit ? "✅ Within Limit" : "❌ Exceeds Limit";
        const summaryText = `
        <div><strong>Conduit ${conduit.id}:</strong> Fill = ${(conduit.fillRatio * 100).toFixed(2)}%, Allowed = ${(conduit.spaceFactor * 100).toFixed(2)}% → ${status}</div>
      `;
        summary.innerHTML += summaryText;

        // Sort cables by name or any other criteria if needed
        conduit.cables.forEach(cable => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
            <td>${cable.name}</td>
            <td>${cable.diameter.toFixed(2)}</td>
            <td>${cable.area.toFixed(2)}</td>
            <td>Conduit ${conduit.id}</td>
          `;
            tbody.appendChild(tr);
        });
    });
}

function clearMultiFillDisplay() {
    document.getElementById("multi-fill-summary").innerHTML = "";
    document.querySelector("#multi-conduit-table tbody").innerHTML = "";
}

// New helper function to distribute and update multi fill display
function distributeAndUpdateMulti() {
    const cables = [...document.querySelectorAll("#cable-table tbody tr")].map(row => ({
        name: row.querySelector(".name").textContent,
        diameter: parseFloat(row.querySelector(".diameter").textContent)
    }));

    const quantity = parseInt(document.getElementById("multi-quantity").value);
    const size = parseInt(document.getElementById("multi-size").value);

    if (!quantity || !size || cables.length === 0) {
        clearMultiFillDisplay();
        return;
    }

    const distributed = distributeCablesAcrossConduits(cables, size, quantity);
    updateMultiFillDisplay(distributed);
}

document.addEventListener("DOMContentLoaded", () => {
    const addDbBtn = document.getElementById("add-cable-db-btn");
    const cableDbSelect = document.getElementById("cable-db-select");
    const addManualBtn = document.getElementById("add-cable-btn");
    const cableNameInput = document.getElementById("cable-name");
    const cableDiameterInput = document.getElementById("cable-diameter");
    const conduitSelect = document.getElementById("conduit-select");
    const multiQuantitySelect = document.getElementById("multi-quantity");
    const multiSizeSelect = document.getElementById("multi-size");
    const distributeBtn = document.getElementById("distribute-btn");

    addDbBtn.addEventListener("click", () => {
        const val = cableDbSelect.value;
        if (!val) return alert("Select a cable from the database first.");
        const [name, diameter] = val.split("|");
        addCableToTable(name, parseFloat(diameter));
        cableDbSelect.value = "";
    });

    addManualBtn.addEventListener("click", () => {
        const name = cableNameInput.value.trim();
        const diameter = parseFloat(cableDiameterInput.value);
        if (!name) return alert("Enter cable name.");
        if (!diameter || diameter <= 0) return alert("Enter valid cable diameter.");
        addCableToTable(name, diameter);
        cableNameInput.value = "";
        cableDiameterInput.value = "";
    });

    conduitSelect.addEventListener("change", () => {
        updateFillInfo();
        updateCanvas();
    });

    document.querySelectorAll('input[name="recommend-mode"]').forEach(radio => {
        radio.addEventListener("change", () => {
            const mode = document.querySelector('input[name="recommend-mode"]:checked').value;
            const multiOptions = document.getElementById("multi-conduit-options");
            const singleSection = document.getElementById("single-mode-section");
            const fillSectionSingle = document.getElementById("single-fill-info-section");
            const fillSectionMulti = document.getElementById("multi-fill-info-section");

            // Reset dropdowns to "Select" placeholder
            conduitSelect.value = "";
            multiQuantitySelect.value = "";
            multiSizeSelect.value = "";

            if (mode === "multi") {
                multiOptions.style.display = "block";
                singleSection.style.display = "none";
                fillSectionSingle.style.display = "none";
                fillSectionMulti.style.display = "block";
                distributeAndUpdateMulti();
            } else {
                multiOptions.style.display = "none";
                singleSection.style.display = "block";
                fillSectionSingle.style.display = "block";
                fillSectionMulti.style.display = "none";
                clearMultiFillDisplay();
            }

            updateRecommendation();
            updateFillInfo();
            updateCanvas();
        });
    });

    multiQuantitySelect.addEventListener("change", () => {
        distributeAndUpdateMulti();
        updateCanvas();
    });
    multiSizeSelect.addEventListener("change", () => {
        distributeAndUpdateMulti();
        updateCanvas();
    });

    distributeBtn.addEventListener("click", () => {
        alert("Multi conduit fill info now updates automatically when quantity/size or cables change.");
    });

    // Initial recommendation update on load
    updateRecommendation();
    updateFillInfo();
    updateCanvas();
});

let cableData = []; // will hold full cable objects

function cableCrossSectionArea(diameter) {
  return Math.PI * (diameter / 2) ** 2;
}

function openCableModal() {
  const modal = document.getElementById('cableModal');
  modal.style.display = 'block';
  if (cableData.length === 0) {
    fetch('/api/cables')
      .then(response => response.json())
      .then(data => {
        cableData = data;
        populateModalTable(cableData);
      });
  } else {
    populateModalTable(cableData);
  }
}

function closeCableModal() {
  document.getElementById('cableModal').style.display = 'none';
  clearFilters();
}

function populateModalTable(data) {
  const tbody = document.querySelector('#modalCableTable tbody');
  tbody.innerHTML = '';
  data.forEach((cable, i) => {
    const row = document.createElement('tr');

    const selectCell = document.createElement('td');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'row-checkbox';
    checkbox.dataset.index = i;
    selectCell.appendChild(checkbox);
    row.appendChild(selectCell);

    const cols = [
      'name',
      'brand',
      'type',
      'cores',
      'conductor_size_mm2',
      'conductor_type',
      'insulation',
      'sheath',
      'voltage_rating',
      'overall_diameter_mm'
    ];
    cols.forEach(col => {
      const cell = document.createElement('td');
      cell.textContent = cable[col] !== undefined ? cable[col] : '';
      row.appendChild(cell);
    });

    tbody.appendChild(row);
  });
}

document.addEventListener('input', function(event) {
  if (event.target.classList.contains('filter-input')) {
    const input = event.target;
    const filterValue = input.value.toLowerCase();
    const columnIndex = parseInt(input.dataset.column, 10);
    const tbody = document.querySelector('#modalCableTable tbody');
    for (const row of tbody.rows) {
      const cellText = row.cells[columnIndex].textContent.toLowerCase();
      row.style.display = cellText.includes(filterValue) ? '' : 'none';
    }
  }
});

document.getElementById('selectAllCheckbox').addEventListener('change', function() {
  const checkboxes = document.querySelectorAll('.row-checkbox');
  checkboxes.forEach(cb => cb.checked = this.checked);
});

document.getElementById('addSelectedBtn').addEventListener('click', function() {
    const checkboxes = document.querySelectorAll('.row-checkbox:checked');
  
    checkboxes.forEach(cb => {
      const idx = parseInt(cb.dataset.index, 10);
      const cable = cableData[idx];
  
      const diameter = cable.overall_diameter_mm || 0;
  
      // Use your existing function to add cable and trigger all updates
      addCableToTable(cable.name, diameter);
    });
  
    closeCableModal();
  });
  

  function updateRemoveButtons() {
    document.querySelectorAll('#cable-table .remove-btn').forEach(btn => {
      btn.onclick = () => {
        btn.closest('tr').remove();
        updateFillInfo();
        updateRecommendation();
        updateCanvas();
        if (document.querySelector('input[name="recommend-mode"]:checked').value === "multi") {
          distributeAndUpdateMulti();
        } else {
          clearMultiFillDisplay();
        }
      };
    });
  }

function clearFilters() {
  document.querySelectorAll('#modalCableTable thead input.filter-input').forEach(input => input.value = '');
  const tbody = document.querySelector('#modalCableTable tbody');
  for (const row of tbody.rows) {
    row.style.display = '';
  }
  document.querySelector('#selectAllCheckbox').checked = false;
}

window.onclick = function(event) {
  const modal = document.getElementById('cableModal');
  if (event.target === modal) {
    closeCableModal();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  updateRemoveButtons();
});
