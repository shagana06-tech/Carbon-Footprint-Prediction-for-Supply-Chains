import os
import logging
from typing import List, Dict, Any, Tuple, Optional

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False

logger = logging.getLogger("ml-service.calculator")

# Verified local factor table
LOCAL_FACTORS = {
    "electricity": {
        "factorValue": 0.82,  # kg CO2e / kWh
        "unit": "kWh",
        "scope": 2,
        "region": "India"
    },
    "diesel": {
        "factorValue": 2.68,  # kg CO2e / litre
        "unit": "litre",
        "scope": 1,
        "region": "Global"
    },
    "roadTransport": {
        "factorValue": 0.14,  # kg CO2e / ton-km
        "unit": "km",
        "scope": 3,
        "region": "Global"
    },
    "rawMaterial": {
        "factorValue": 5.9,  # kg CO2e / kg
        "unit": "kg",
        "scope": 3,
        "region": "Global"
    }
}

CLIMATIQ_API_KEY = os.getenv("CLIMATIQ_API_KEY")

def lookup_climatiq_factor(activity_type: str, region: str, unit: str) -> Optional[float]:
    """
    Attempts to fetch a factor from Climatiq. If anything fails, returns None.
    """
    if not CLIMATIQ_API_KEY or not REQUESTS_AVAILABLE:
        return None
        
    try:
        # Simple mapping to Climatiq activity IDs / searches
        mappings = {
            "electricity": {"activity_id": "electricity-energy_source_grid_mix", "region": "IN"},
            "diesel": {"activity_id": "fuel-type_diesel", "region": "XX"},
            "roadTransport": {"activity_id": "transport-road_freight", "region": "XX"},
            "rawMaterial": {"activity_id": "material-cotton", "region": "XX"}
        }
        
        mapping = mappings.get(activity_type)
        if not mapping:
            return None
            
        headers = {
            "Authorization": f"Bearer {CLIMATIQ_API_KEY}",
            "Content-Type": "application/json"
        }
        
        # We perform a lightweight estimate search or direct factor request.
        # To be safe and fast, we use the Climatiq search API or estimation request.
        # This is a sample estimate endpoint call.
        payload = {
            "emission_factor": {
                "activity_id": mapping["activity_id"]
            },
            "parameters": {
                "money": 1,
                "money_unit": "usd"
            }
        }
        
        # Note: Depending on Climatiq version, endpoints vary.
        # We query the beta3/estimate API as standard practice.
        res = requests.post("https://beta3.api.climatiq.io/estimate", json=payload, headers=headers, timeout=2.5)
        if res.status_code == 200:
            data = res.json()
            # Return factor value if found
            return data.get("constituent_gases", {}).get("co2e")
    except Exception as e:
        logger.warning(f"Climatiq lookup failed for {activity_type}: {str(e)}. Falling back to local factors.")
    
    return None

def calculate_item_emission(entry: Dict[str, Any]) -> Tuple[float, int]:
    """
    Calculates emissions in kg CO2e for a single entry.
    Returns: (emissions_kg, scope)
    """
    activity_type = entry.get("activityType")
    quantity = entry.get("quantity", 0)
    region = entry.get("region", "Global")
    unit = entry.get("unit", "")
    cargo_weight = entry.get("cargoWeightTons", 0)
    
    # Check if local factor exists
    if activity_type not in LOCAL_FACTORS:
        raise ValueError(f"Unknown activityType: {activity_type}")
        
    factor_info = LOCAL_FACTORS[activity_type]
    scope = factor_info["scope"]
    
    # Try Climatiq lookup first if key present
    factor_value = lookup_climatiq_factor(activity_type, region, unit)
    if factor_value is None:
        factor_value = factor_info["factorValue"]
        
    # Calculate based on formula rules
    if activity_type == "roadTransport":
        # distance (km) * cargo weight (tons) * factor (kg/ton-km)
        emissions = quantity * cargo_weight * factor_value
    else:
        # quantity * factor
        emissions = quantity * factor_value
        
    return float(emissions), int(scope)

def process_calculations(entries: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Executes calculations for an array of entries.
    Sums up Scope 1/2/3 and computes breakdown by activity type.
    """
    if not CLIMATIQ_API_KEY:
        logger.warning("CLIMATIQ_API_KEY is not set. Running calculations entirely on local factor tables.")
        
    scope1 = 0.0
    scope2 = 0.0
    scope3 = 0.0
    
    breakdown_map = {}
    calculated_entries = []
    
    for entry in entries:
        emissions, scope = calculate_item_emission(entry)
        
        # Add to scope sums
        if scope == 1:
            scope1 += emissions
        elif scope == 2:
            scope2 += emissions
        elif scope == 3:
            scope3 += emissions
            
        activity_type = entry["activityType"]
        breakdown_map[activity_type] = breakdown_map.get(activity_type, 0.0) + emissions
        
        calculated_entries.append({
            "activityType": activity_type,
            "quantity": entry["quantity"],
            "unit": entry["unit"],
            "region": entry["region"],
            "baselineKg": emissions,
            "scope": scope
        })
        
    total = scope1 + scope2 + scope3
    
    breakdown = []
    for activity_type, kg in breakdown_map.items():
        pct = (kg / total * 100) if total > 0 else 0.0
        breakdown.append({
            "activityType": activity_type,
            "kg": kg,
            "pct": pct
        })
        
    return {
        "scope1Kg": scope1,
        "scope2Kg": scope2,
        "scope3Kg": scope3,
        "totalKg": total,
        "breakdown": breakdown,
        "entries": calculated_entries
    }
