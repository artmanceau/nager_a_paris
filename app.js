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
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5&countrycodes=fr`);
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

// --- Recommendation Engine Utilities ---

async function getCoordsFromAddress(address) {
    if (!address) return null;
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=fr`);
        const data = await response.json();
        if (data && data.length > 0) {
            return {
                lat: parseFloat(data[0].lat),
                lon: parseFloat(data[0].lon)
            };
        }
    } catch (error) {
        console.error("Geocoding error:", error);
    }
    return null;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function calculateRRF(rankGeo, rankPref, k = 60) {
    return (1 / (k + rankGeo)) + (1 / (k + rankPref));
}

// --- Data Loading ---

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

        const displayScore = scores[lieu.id] ? scores[lieu.id].toFixed(4) : '—';
        const displayDist = lieu.distance ? `${lieu.distance.toFixed(2)} km` : '—';

        const renderDrops = (val) => {
            const rounded = Math.round(val);
            const drops = '💧'.repeat(Math.max(0, Math.min(5, rounded)));
            const empty = '⚪'.repeat(5 - Math.max(0, Math.min(5, rounded)));
            return drops + empty;
        };

        card.innerHTML = `
            <div class="card-header">
                <h3>${lieu.name}</h3>
                <div class="card-metrics">
                    <span class="card-score">Score: ${displayScore}</span>
                    <span class="card-dist">Distance: ${displayDist}</span>
                </div>
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
        // 1. Geocoding
        const userCoords = await getCoordsFromAddress(userAddress);

        // 2. Geographic Ranking
        const geoResults = [];
        if (userCoords) {
            allLieux.forEach(pool => {
                const dist = calculateDistance(userCoords.lat, userCoords.lon, pool.latitude, pool.longitude);
                geoResults.push({ id: pool.id, dist });
            });
            geoResults.sort((a, b) => a.dist - b.dist);
        }

        const geoRanks = {};
        if (userCoords && geoResults.length > 0) {
            geoResults.forEach((res, i) => {
                geoRanks[res.id] = i + 1;
            });
        } else {
            // Neutral rank for all if no coordinates
            allLieux.forEach(pool => {
                geoRanks[pool.id] = allLieux.length + 1;
            });
        }

        // 3. Preference Ranking
        const prefResults = [];
        allLieux.forEach(pool => {
            let totalScore = 0;
            for (const [attr, weight] of Object.entries(weights)) {
                const poolScore = pool.scores[attr] ? pool.scores[attr].val : 0;
                totalScore += poolScore * weight;
            }
            prefResults.push({ id: pool.id, score: totalScore });
        });
        prefResults.sort((a, b) => b.score - a.score);

        const prefRanks = {};
        prefResults.forEach((res, i) => {
            prefRanks[res.id] = i + 1;
        });

        // 4. RRF Fusion
        const rankedData = allLieux.map(pool => {
            const pid = pool.id;

            let rrf_score;
            if (userCoords) {
                rrf_score = calculateRRF(geoRanks[pid], prefRanks[pid]);
            } else {
                // If no address, the score is purely based on preference rank
                // We can represent this as just 1 / (60 + rankPref)
                // or treat geoRank as a constant neutral value.
                // To stay consistent with the RRF formula:
                rrf_score = 1 / (60 + prefRanks[pid]);
            }

            let dist = null;
            if (userCoords) {
                dist = calculateDistance(userCoords.lat, userCoords.lon, pool.latitude, pool.longitude);
            }

            return {
                id: pid,
                name: pool.name,
                rrf_score: rrf_score,
                distance: dist
            };
        });

        rankedData.sort((a, b) => b.rrf_score - a.rrf_score);

        // 5. UI Integration
        const finalSortedLieux = rankedData.map(item => {
            const pool = allLieux.find(l => l.id === item.id);
            return { ...pool, calculatedScore: item.rrf_score, distance: item.distance };
        });

        const scoreMap = {};
        rankedData.forEach(item => scoreMap[item.id] = item.rrf_score);

        renderLieux(finalSortedLieux, scoreMap);

    } catch (error) {
        console.error("Ranking error:", error);
        alert("Une erreur est survenue lors du calcul du classement.");
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
