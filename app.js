let allLieux = [];

async function loadLieux() {
    try {
        const response = await fetch('./data.json');
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

        // Calculate a display score if ranking was performed
        const displayScore = scores[lieu.id] ? scores[lieu.id].toFixed(1) : '—';

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
                    ${Object.entries(lieu.scores).map(([key, val]) => `
                        <div class="score-bar-container">
                            <div class="score-label">
                                <span style="text-transform: capitalize">${key}</span>
                                <span>${val}/10</span>
                            </div>
                            <div class="score-bar-bg">
                                <div class="score-bar-fill" style="width: ${val * 10}%"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        card.addEventListener('click', () => {
            card.classList.toggle('expanded');
        });

        container.appendChild(card);
    });
}

function calculateRanking() {
    const userAddress = document.getElementById('filter-address').value;
    const filters = {
        calme: parseFloat(document.getElementById('filter-calme').value),
        nature: parseFloat(document.getElementById('filter-nature').value),
        culture: parseFloat(document.getElementById('filter-culture').value),
        restaurants: parseFloat(document.getElementById('filter-restaurants').value),
    };

    // Simple weighted ranking algorithm
    const ranked = allLieux.map(lieu => {
        let totalDiff = 0;
        for (const key in filters) {
            if (lieu.scores[key] !== undefined) {
                totalDiff += Math.abs(lieu.scores[key] - filters[key]);
            }
        }

        // Handle address "distance" logic (simplified for static demo)
        // In a real app, we would use a geocoding API to calculate real distance
        let distancePenalty = 0;
        if (userAddress) {
            // Dummy logic: if the pool address contains any word from user address, it's "closer"
            const userWords = userAddress.toLowerCase().split(' ');
            const lieuWords = lieu.address.toLowerCase().split(' ');
            const matches = userWords.filter(word => lieuWords.includes(word)).length;
            distancePenalty = matches > 0 ? 0 : 1.0;
        }

        // Convert difference to a score out of 10
        const score = 10 - (totalDiff / 4) - distancePenalty;

        return { ...lieu, calculatedScore: score };
    });

    // Sort by score descending

    ranked.sort((a, b) => b.calculatedScore - a.calculatedScore);

    // Map for rendering
    const scoreMap = {};
    ranked.forEach(l => scoreMap[l.id] = l.calculatedScore);

    renderLieux(ranked, scoreMap);
}

// Update labels when sliders move
function setupSliderLabels() {
    ['calme', 'nature', 'culture', 'restaurants'].forEach(id => {
        const slider = document.getElementById(`filter-${id}`);
        const label = document.getElementById(`val-${id}`);
        slider.addEventListener('input', () => {
            label.textContent = slider.value;
        });
    });
}

window.addEventListener('DOMContentLoaded', () => {
    loadLieux();
    setupSliderLabels();
    document.getElementById('search-btn').addEventListener('click', calculateRanking);
});
