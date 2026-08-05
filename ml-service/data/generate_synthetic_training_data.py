import os
import pandas as pd
import numpy as np

def generate_data(num_rows=2000, save_path=None):
    np.random.seed(42)
    
    activity_types = ["electricity", "diesel", "roadTransport", "rawMaterial"]
    regions = ["India", "USA", "Europe", "Asia-Pacific"]
    seasons = ["Spring", "Summer", "Autumn", "Winter"]
    
    data = []
    
    for i in range(num_rows):
        activity = np.random.choice(activity_types)
        region = np.random.choice(regions)
        season = np.random.choice(seasons)
        equipment_age = float(np.random.randint(0, 25))
        
        # Base quantities and baseline calculation
        if activity == "electricity":
            quantity = np.random.uniform(500, 10000)
            baseline = quantity * 0.82
        elif activity == "diesel":
            quantity = np.random.uniform(50, 1000)
            baseline = quantity * 2.68
        elif activity == "roadTransport":
            quantity = np.random.uniform(100, 5000)
            weight = np.random.uniform(1, 20)
            baseline = quantity * weight * 0.14
        else: # rawMaterial
            quantity = np.random.uniform(100, 5000)
            baseline = quantity * 5.9
            
        # Start multiplier
        multiplier = 1.0
        
        # Rule 1: Equipment older than 10 years runs 10% - 25% hotter (higher emissions)
        if equipment_age > 10:
            # Linear scaling from 10% at 10 years to 25% at 25 years
            age_multiplier = 0.10 + ((equipment_age - 10) / 15.0) * 0.15
            multiplier += age_multiplier
            
        # Rule 2: India region gets a grid-intensity multiplier (+15% for electricity)
        if region == "India" and activity == "electricity":
            multiplier += 0.15
            
        # Rule 3: Winter season bumps heating-related activities (diesel +20% heating bump)
        if season == "Winter" and activity == "diesel":
            multiplier += 0.20
            
        # Rule 4: Apply Gaussian noise centered around 0 with std dev 5%
        noise = np.random.normal(0, 0.05)
        actual = baseline * multiplier * (1 + noise)
        
        data.append({
            "activityType": activity,
            "region": region,
            "equipmentAgeYears": equipment_age,
            "season": season,
            "baselineKg": baseline,
            "actualKg": actual
        })
        
    df = pd.DataFrame(data)
    
    if save_path:
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        df.to_csv(save_path, index=False)
        print(f"Generated {num_rows} synthetic rows and saved to {save_path}")
        
    return df

if __name__ == "__main__":
    current_dir = os.path.dirname(os.path.abspath(__file__))
    generate_data(num_rows=2500, save_path=os.path.join(current_dir, "synthetic_activity_data.csv"))
