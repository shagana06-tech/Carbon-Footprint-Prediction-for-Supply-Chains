import os
import pandas as pd
import requests

def seed_apple_data():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    excel_path = os.path.join(current_dir, "Carbon_Footprint_Dataset_Apple.xlsx")
    
    if not os.path.exists(excel_path):
        print(f"Excel file not found at {excel_path}")
        return
        
    print(f"Reading Excel workbook: {excel_path}...")
    # Read the Yearly_Scope_Summary sheet
    df = pd.read_excel(excel_path, sheet_name="Yearly_Scope_Summary")
    
    # Print columns for debug
    print("Found columns in sheet 'Yearly_Scope_Summary':", df.columns.tolist())
    
    records = []
    
    # Map columns dynamically using heuristics
    col_mapping = {}
    for col in df.columns:
        col_lower = str(col).lower()
        if "year" in col_lower:
            col_mapping["fiscalYear"] = col
        elif "scope 1" in col_lower:
            col_mapping["scope1"] = col
        elif "scope 2" in col_lower:
            col_mapping["scope2"] = col
        elif "scope 3" in col_lower:
            col_mapping["scope3"] = col
        elif "total" in col_lower:
            col_mapping["total"] = col
            
    # Validate mapping
    required = ["fiscalYear", "scope1", "scope2", "scope3", "total"]
    for req in required:
        if req not in col_mapping:
            raise KeyError(f"Could not map column '{req}' from sheet headers. Available: {df.columns.tolist()}")
            
    for _, row in df.iterrows():
        # Get raw year, sometimes string e.g. "FY2015" or number e.g. 2015
        raw_year = row[col_mapping["fiscalYear"]]
        if isinstance(raw_year, str):
            # Extract digits
            year = int(''.join(filter(str.isdigit, raw_year)))
        else:
            year = int(raw_year)
            
        # Convert metric tons to kg (multiply by 1000)
        scope1_kg = float(row[col_mapping["scope1"]]) * 1000.0
        scope2_kg = float(row[col_mapping["scope2"]]) * 1000.0
        scope3_kg = float(row[col_mapping["scope3"]]) * 1000.0
        total_kg = float(row[col_mapping["total"]]) * 1000.0
        
        records.append({
            "fiscalYear": year,
            "scope1Kg": scope1_kg,
            "scope2Kg": scope2_kg,
            "scope3Kg": scope3_kg,
            "totalKg": total_kg
        })
        
    payload = {
        "companyName": "Apple Inc. — Demo",
        "records": records
    }
    
    node_url = "http://localhost:5000/api/dashboard/seed-apple"
    print(f"Posting {len(records)} records to backend at {node_url}...")
    
    try:
        res = requests.post(node_url, json=payload, timeout=10)
        if res.status_code == 200:
            print("Successfully seeded Apple Inc. demo trend data!")
            print(res.json())
        else:
            print(f"Failed to seed data. Status: {res.status_code}, Detail: {res.text}")
    except Exception as e:
        print(f"Error making REST call to backend-node: {str(e)}")

if __name__ == "__main__":
    seed_apple_data()
