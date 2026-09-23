console.log("Frontend initialized");

async function loadLieux() {
    try {
        const response = await fetch('./backend/data/lieux.json');
        const data = await response.json();
        console.log("Data loaded:", data);

        const appDiv = document.getElementById('app');
        const list = document.createElement('div');

        data.forEach(lieu => {
            const item = document.createElement('div');
            item.className = 'lieu-card';
            item.innerHTML = `
                <h3>${lieu.name}</h3>
                <p>${lieu.description}</p>
                <p><strong>Score Calme:</strong> ${lieu.scores.calme}</p>
            `;
            list.appendChild(item);
        });

        appDiv.appendChild(list);
    } catch (error) {
        console.error("Error loading data:", error);
    }
}

window.addEventListener('DOMContentLoaded', loadLieux);
