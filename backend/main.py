import json
import math
from typing import List, Dict
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from geopy.geocoders import Nominatim
from geopy.distance import geodesic

app = FastAPI(title="Nager à Paris API")

geolocator = Nominatim(user_agent="nager_a_paris")

# Data model for the response
class PoolRecommendation(BaseModel):
    id: str
    name: str
    rrf_score: float
    distance: float

# Load pools from the shared JSON file
def load_data():
    with open("data.json", "r", encoding="utf-8") as f:
        return json.load(f)

class UserPreferences(BaseModel):
    address: str
    weights: Dict[str, float]

def calculate_rrf_score(rank_geo: int, rank_pref: int, k: int = 60):
    return (1 / (k + rank_geo)) + (1 / (k + rank_pref))

@app.get("/")
async def root():
    return {"message": "Welcome to Nager à Paris API. Visit /docs for documentation."}

@app.post("/recommend", response_model=List[PoolRecommendation])
async def recommend(prefs: UserPreferences):
    # 1. Geocoding (Optional)
    user_coords = None
    if prefs.address:
        location = geolocator.geocode(prefs.address)
        if location:
            user_coords = (location.latitude, location.longitude)
        else:
            # If address is provided but not found, we still proceed
            # but we can't rank by distance.
            pass

    pools = load_data()

    # 2. Distance Ranking
    geo_ranks = {}
    geo_results = []
    if user_coords:
        for pool in pools:
            dist = geodesic(user_coords, (pool["latitude"], pool["longitude"])).km
            geo_results.append({"id": pool["id"], "dist": dist})

        geo_results.sort(key=lambda x: x["dist"])
        geo_ranks = {res["id"]: i + 1 for i, res in enumerate(geo_results)}
    else:
        # If no coordinates, every pool gets the same "worst" rank
        # or we just handle the RRF differently.
        # To keep RRF consistent, we assign them all a neutral rank.
        for pool in pools:
            geo_ranks[pool["id"]] = len(pools) + 1

    # 3. Preference Score Ranking
    pref_results = []
    for pool in pools:
        total_score = sum(
            pool["scores"].get(attr, 0) * weight
            for attr, weight in prefs.weights.items()
        )
        pref_results.append({"id": pool["id"], "score": total_score})

    pref_results.sort(key=lambda x: x["score"], reverse=True)
    pref_ranks = {res["id"]: i + 1 for i, res in enumerate(pref_results)}

    # 4. Reciprocal Rank Fusion (RRF)
    final_rankings = []
    for pool in pools:
        pid = pool["id"]
        rrf_score = calculate_rrf_score(geo_ranks[pid], pref_ranks[pid])

        # Find distance if it exists, else None
        dist = None
        if user_coords:
            # Find the dist for this pid in geo_results
            for gr in geo_results:
                if gr["id"] == pid:
                    dist = gr["dist"]
                    break

        final_rankings.append({
            "id": pid,
            "name": pool["name"],
            "rrf_score": rrf_score,
            "distance": dist
        })

    final_rankings.sort(key=lambda x: x["rrf_score"], reverse=True)

    return final_rankings

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
