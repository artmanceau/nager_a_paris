let allLieux = [];

// --- Autocomplete Logic ---
function debounce(func, timeout = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

async function fetchAddressSuggestions(query) {
    if (query.length < 3) return;
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5`);
        const data = await response.json();
        displaySuggestions(data);
    } catch (error) {
        console.error("Error fetching addresses:", error);
    }
}

function displaySuggestions(results) {
    const list = document.getElementById('address-suggestions');
    if (!list) return;
    list.innerHTML = '';
    results.forEach(item => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.textContent = item.display_name;
        div.onclick = () => {
            document.getElementById('filter-address').value = item.display_name;
            list.innerHTML = '';
        };
        list.appendChild(div);
    });
}

async function loadLieux() {
    try {
        const response = await fetch(`./data.json?v=${new Date().getTime()}`);
        allLieux = await response.json();
        renderLieux(allLieux);
    } catch (error) {
        console.error("Error loading data:", error);
        document.getElementById('pool-list').innerHTML = '<p>Erreur lors du chargement des données.</p>';
    }
}

function renderLieux(lieux, scores = {}) {
    const container = document.getElementById('pool-list');
    container.innerHTML = '';

    lieux.forEach(lieu => {
        const card = document.createElement('div');
        card.className = 'lieu-card';

        const displayScore = scores[lieu.id] ? scores[lieu.id].toFixed(1) : '—';

        const renderDrops = (val) => {
            const rounded = Math.round(val);
            const drops = '💧'.repeat(Math.max(0, Math.min(5, rounded)));
            const empty = '⚪'.repeat(5 - Math.max(0, Math.min(5, rounded)));
            return drops + empty;
        };

        card.innerHTML = `
            <div class="card-header">
                <h3>${lieu.name}</h3>
                <span class="card-score">Score: ${displayScore}</span>
            </div>
            <div class="card-content">
                <div class="info-grid">
                    <div class="info-item"><strong>Adresse</strong>${lieu.address}</div>
                    <div class="info-item"><strong>Notes</strong>${lieu.notes}</div>
                </div>
                <p><strong>Description:</strong> ${lieu.description}</p>
                <div class="details-scores">
                    ${Object.entries(lieu.scores).map(([key, item]) => `
                        <div class="score-bar-container">
                            <div class="score-label">
                                <span>${item.label}</span>
                                <span>${renderDrops(item.val)}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="extra-details" style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #eee; font-size: 0.9rem;">
                    <p><strong>Vestiaires:</strong> ${lieu.details.vestiaire_sep ? 'Séparés H/F' : 'Communs'}</p>
                    <p><strong>Détail vestiaires:</strong> ${lieu.details.desc_vestiaire}</p>
                    <p><strong>Détail bassin:</strong> ${lieu.details.desc_bassin}</p>
                </div>
            </div>
        `;

        card.addEventListener('click', () => {
            card.classList.toggle('expanded');
        });

        container.appendChild(card);
    });
}

async function calculateRanking() {
    const userAddress = document.getElementById('filter-address').value;

    const weights = {
        beaute: parseFloat(document.getElementById('filter-beaute').value) / 10,
        temperature: parseFloat(document.getElementById('filter-temp').value) / 10,
        frequentation: parseFloat(document.getElementById('filter-freq').value) / 10,
        proprete_bassin: parseFloat(document.getElementById('filter-prop').value) / 10,
    };

    try {
        const response = await fetch('http://localhost:8001/recommend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: userAddress, weights: weights })
        });

        if (!response.ok) throw new Error('Backend error');

        const rankedData = await response.json();

        const poolsWithDist = rankedData.filter(item => item.distance !== null);
        const avgScore = rankedData.reduce((acc, item) => acc + item.rrf_score, 0) / rankedData.length;
        const avgDist = poolsWithDist.length > 0
            ? poolsWithDist.reduce((acc, item) => acc + item.distance, 0) / poolsWithDist.length
            : null;

        const summaryDiv = document.getElementById('search-summary');
        let summaryText = `Moyenne : ${avgScore.toFixed(4)}`;
        if (avgDist !== null) {
            summaryText += ` | Distance moyenne : ${avgDist.toFixed(2)} km`;
        } else {
            summaryText += ` | Distance : N/A (adresse non fournie)`;
        }
        summaryDiv.innerHTML = summaryText;

        const finalSortedLieux = rankedData.map(item => {
            const pool = allLieux.find(l => l.id === item.id);
            return { ...pool, calculatedScore: item.rrf_score };
        });

        const scoreMap = {};
        rankedData.forEach(item => scoreMap[item.id] = item.rrf_score);

        renderLieux(finalSortedLieux, scoreMap);
    } catch (error) {
        console.error("Ranking error:", error);
        alert("Erreur lors de la connexion au serveur de recommandation.");
    }
}

function setupSliderLabels() {
    ['beaute', 'temp', 'freq', 'prop'].forEach(id => {
        const slider = document.getElementById(`filter-${id}`);
        const label = document.getElementById(`val-${id}`);
        if (slider && label) {
            slider.addEventListener('input', () => {
                label.textContent = slider.value;
            });
        }
    });
}

window.addEventListener('DOMContentLoaded', () => {
    loadLieux();
    setupSliderLabels();
    document.getElementById('search-btn').addEventListener('click', calculateRanking);

    const addressInput = document.getElementById('filter-address');
    if (addressInput) {
        addressInput.addEventListener('input', debounce((e) => {
            fetchAddressSuggestions(e.target.value);
        }));
    }
});
