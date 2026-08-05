import unittest
from calculator import process_calculations

class TestCalculator(unittest.TestCase):
    def test_salem_textile_company_calculation(self):
        # Salem textile company entries
        entries = [
            {
                "activityType": "electricity",
                "quantity": 5000.0,
                "unit": "kWh",
                "region": "India"
            },
            {
                "activityType": "diesel",
                "quantity": 200.0,
                "unit": "litre",
                "region": "Global"
            },
            {
                "activityType": "roadTransport",
                "quantity": 1000.0,
                "unit": "km",
                "region": "Global",
                "cargoWeightTons": 5.0
            },
            {
                "activityType": "rawMaterial",
                "quantity": 2000.0,
                "unit": "kg",
                "region": "Global"
            }
        ]

        res = process_calculations(entries)

        # 1. Assert individual baseline calculations
        self.assertAlmostEqual(res["entries"][0]["baselineKg"], 4100.0, places=4)  # 5000 * 0.82
        self.assertEqual(res["entries"][0]["scope"], 2)
        
        self.assertAlmostEqual(res["entries"][1]["baselineKg"], 536.0, places=4)   # 200 * 2.68
        self.assertEqual(res["entries"][1]["scope"], 1)
        
        self.assertAlmostEqual(res["entries"][2]["baselineKg"], 700.0, places=4)   # 1000 * 5 * 0.14
        self.assertEqual(res["entries"][2]["scope"], 3)
        
        self.assertAlmostEqual(res["entries"][3]["baselineKg"], 11800.0, places=4) # 2000 * 5.9
        self.assertEqual(res["entries"][3]["scope"], 3)

        # 2. Assert scope sums
        self.assertEqual(res["scope1Kg"], 536.0)
        self.assertEqual(res["scope2Kg"], 4100.0)
        self.assertEqual(res["scope3Kg"], 12500.0)  # 700 + 11800
        self.assertEqual(res["totalKg"], 17136.0)   # 4100 + 536 + 700 + 11800

        # 3. Assert breakdown percentages
        breakdown_types = {item["activityType"]: item["pct"] for item in res["breakdown"]}
        self.assertAlmostEqual(breakdown_types["rawMaterial"], 68.86, delta=0.1)
        self.assertAlmostEqual(breakdown_types["electricity"], 23.93, delta=0.1)

if __name__ == "__main__":
    unittest.main()
